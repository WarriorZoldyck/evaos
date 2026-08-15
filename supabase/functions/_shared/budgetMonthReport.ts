import {
  buildCategoryProgressList,
  buildMonthSummary,
  type CategoryProgress,
} from "./budgetProgress.ts";

/**
 * Relatório determinístico "meta x realizado do mês", com os mesmos números
 * da tela de Planejamento Inteligente. Usado pela EVA no WhatsApp.
 */

export interface BudgetMonthReport {
  income: CategoryProgress[];
  expense: CategoryProgress[];
  summary: ReturnType<typeof buildMonthSummary>;
  hasData: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function buildBudgetMonthReport(
  supabase: any,
  userId: string,
  companyId: string | null | undefined,
  now: Date = new Date(),
): Promise<BudgetMonthReport> {
  const year = now.getFullYear();
  const yearStart = `${year}-01-01`;
  const monthStart = `${year}-${pad(now.getMonth() + 1)}-01`;
  const monthEnd = `${year}-${pad(now.getMonth() + 1)}-${pad(
    new Date(year, now.getMonth() + 1, 0).getDate(),
  )}`;
  const monthsElapsed = now.getMonth() + 1;

  const applyCtx = (q: any) => {
    if (companyId === undefined) return q; // sem filtro de contexto
    return companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
  };

  const [{ data: cats }, txRes, targetsRes] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id").eq("user_id", userId),
    applyCtx(
      supabase
        .from("transactions")
        .select("amount, type, category, payment_date, is_internal_transfer")
        .eq("user_id", userId)
        .eq("status", "Pago")
        .gte("payment_date", yearStart)
        .lte("payment_date", monthEnd),
    ),
    applyCtx(
      supabase
        .from("budget_targets")
        .select("kind, category_name, target_amount")
        .eq("user_id", userId),
    ),
  ]);

  const byId = new Map<string, { id: string; name: string; parent_id: string | null }>();
  (cats || []).forEach((c: any) => byId.set(c.id, c));

  /** Nome da categoria raiz — o mesmo agrupamento usado na tela. */
  const rootName = (value: string | null): string => {
    if (!value) return "Sem categoria";
    let node = byId.get(value);
    if (!node) return value;
    let guard = 0;
    while (node.parent_id && byId.has(node.parent_id) && guard < 5) {
      node = byId.get(node.parent_id)!;
      guard++;
    }
    return node.name;
  };

  const acc = {
    income: new Map<string, { year: number; month: number }>(),
    expense: new Map<string, { year: number; month: number }>(),
  };

  (txRes.data || []).forEach((t: any) => {
    if (t.is_internal_transfer === true) return;
    const kind = t.type === "receita" ? "income" : "expense";
    const name = rootName(t.category);
    const bucket = acc[kind];
    const entry = bucket.get(name) || { year: 0, month: 0 };
    const amount = Number(t.amount) || 0;
    entry.year += amount;
    if (t.payment_date >= monthStart) entry.month += amount;
    bucket.set(name, entry);
  });

  const targets = { income: {}, expense: {} } as Record<string, Record<string, number>>;
  (targetsRes.data || []).forEach((r: any) => {
    targets[r.kind === "income" ? "income" : "expense"][r.category_name] =
      Number(r.target_amount) || 0;
  });

  const toInputs = (kind: "income" | "expense") =>
    Array.from(acc[kind].entries())
      .map(([name, v]) => ({
        name,
        average: v.year / monthsElapsed,
        actual: v.month,
        target: targets[kind][name] ?? null,
      }))
      .filter((i) => i.average !== 0 || i.actual !== 0)
      .sort((a, b) => b.average - a.average);

  const income = buildCategoryProgressList(toInputs("income"), "income", now);
  const expense = buildCategoryProgressList(toInputs("expense"), "expense", now);

  return {
    income,
    expense,
    summary: buildMonthSummary(income, expense, now),
    hasData: income.length > 0 || expense.length > 0,
  };
}

/** Texto pronto para o WhatsApp. */
export function formatBudgetMonthMessage(
  report: BudgetMonthReport,
  contextLabel?: string,
): string {
  if (!report.hasData) {
    return "📊 Ainda não tenho lançamentos suficientes deste mês para comparar com as suas metas.";
  }

  const s = report.summary;
  const ctx = contextLabel ? ` (${contextLabel})` : "";
  const lines: string[] = [];

  lines.push(`📊 *Metas deste mês*${ctx} — ${s.elapsedPct}% do mês já passou`);
  lines.push("");
  lines.push(
    `📥 Entradas: ${fmt(s.incomeActual)} de ${fmt(s.incomeTarget)}` +
      (s.incomeTarget > s.incomeActual
        ? ` — faltam ${fmt(s.incomeTarget - s.incomeActual)}`
        : " — meta batida ✅"),
  );
  lines.push(
    `📤 Saídas: ${fmt(s.expenseActual)} de ${fmt(s.expenseTarget)}` +
      (s.expenseActual > s.expenseTarget
        ? ` — estourou ${fmt(s.expenseActual - s.expenseTarget)} ⚠️`
        : ` — ainda cabe ${fmt(s.expenseTarget - s.expenseActual)}`),
  );
  lines.push(`💰 Sobra até agora: ${fmt(s.realizedLeftover)}`);

  if (s.risks.length > 0) {
    lines.push("");
    lines.push("🚨 *Onde não dá para gastar muito mais:*");
    s.risks.slice(0, 5).forEach((r) => {
      const detail =
        r.status === "over"
          ? `estourou ${fmt(r.overBy)}`
          : `só cabe mais ${fmt(r.remaining)}`;
      lines.push(`  • ${r.name}: ${fmt(r.actual)} / ${fmt(r.target)} (${Math.round(r.consumedPct)}%) — ${detail}`);
    });
  }

  const okList = report.expense
    .filter((e) => e.status === "ok")
    .slice(0, 3)
    .map((e) => `${e.name} (${Math.round(e.consumedPct)}%)`);
  if (okList.length > 0) {
    lines.push("");
    lines.push(`👍 Dentro da meta: ${okList.join(", ")}`);
  }

  return lines.join("\n");
}

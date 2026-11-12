// Segunda mensagem "CFO" e prévia no WhatsApp: avisa se a categoria tem meta orçamentária,
// somando lançamentos já registrados (transactions) + pendentes de análise (ai_pending_transactions).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function shouldSendBudgetFollowUp(status: string, transactionId: string | null) {
  return status === "approved" && Boolean(transactionId);
}

async function computeBudgetUsage(
  supabase: any,
  userId: string,
  companyId: string | null,
  catRefs: (string | null | undefined)[],
  type: string,
) {
  const kind = type === "receita" ? "income" : "expense";
  let q = supabase.from("budget_targets").select("category_name, target_amount").eq("user_id", userId).eq("kind", kind);
  q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
  const { data: targets, error: targetError } = await q;
  if (targetError) throw targetError;
  if (!targets?.length) return null;

  const { data: cats, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("user_id", userId);
  if (categoryError) throw categoryError;

  const catById = new Map<string, { id: string; name: string; parent_id?: string | null }>(
    (cats || []).map((c: any) => [c.id, c]),
  );

  // Resolve each ref and walk parent_id so subcategory launches match parent-category targets
  const txNames: string[] = [];
  for (const r of catRefs) {
    if (!r) continue;
    if (UUID_RE.test(r)) {
      let cur = catById.get(r);
      let guard = 0;
      while (cur && guard < 5) {
        const n = norm(cur.name);
        if (n && !txNames.includes(n)) txNames.push(n);
        cur = cur.parent_id ? catById.get(cur.parent_id) : undefined;
        guard++;
      }
    } else {
      const n = norm(r);
      if (n && !txNames.includes(n)) txNames.push(n);
    }
  }

  const target = targets.find((t: any) => txNames.includes(norm(t.category_name)));
  if (!target) return null;

  const tName = norm(target.category_name);
  const targetRootIds = new Set(
    (cats || []).filter((c: any) => norm(c.name) === tName).map((c: any) => c.id),
  );
  const belongsToTarget = (c: any): boolean => {
    let cur = c;
    let guard = 0;
    while (cur && guard < 5) {
      if (norm(cur.name) === tName || targetRootIds.has(cur.id)) return true;
      cur = cur.parent_id ? catById.get(cur.parent_id) : undefined;
      guard++;
    }
    return false;
  };
  const ids = (cats || []).filter(belongsToTarget).map((c: any) => c.id);
  const refs = [target.category_name, ...ids];

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = now.getFullYear(), m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m + 1)}-01`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad(m + 1)}-${pad(daysInMonth)}`;
  const orFilter = ["category", "subcategory", "subcategory2"]
    .flatMap((col) => refs.map((r) => `${col}.eq.${JSON.stringify(r)}`)).join(",");

  const ctx = (qb: any) => (companyId ? qb.eq("company_id", companyId) : qb.is("company_id", null));
  const { data: txs, error } = await ctx(
    supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", type)
      .gte("competence_date", start).lte("competence_date", end).or(orFilter),
  );
  if (error) throw error;
  const approvedUsed = (txs || []).reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);

  const { data: pendingTxs, error: pendingError } = await ctx(
    supabase.from("ai_pending_transactions").select("amount").eq("user_id", userId).eq("type", type)
      .in("status", ["pending", "duplicate_review"])
      .gte("competence_date", start).lte("competence_date", end).or(orFilter),
  );
  if (pendingError) throw pendingError;
  const pendingUsed = (pendingTxs || []).reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);

  const goal = Number(target.target_amount) || 0;
  if (goal <= 0) return null;

  return {
    kind,
    cat: target.category_name as string,
    approvedUsed,
    pendingUsed,
    used: approvedUsed + pendingUsed,
    goal,
    day: now.getDate(),
    daysInMonth,
    monthKey: `${y}-${pad(m + 1)}`,
  };
}

function breakdownSuffix(approvedUsed: number, pendingUsed: number): string {
  if (pendingUsed <= 0) return "";
  return ` (${brl(approvedUsed)} lançados + ${brl(pendingUsed)} pendentes de análise)`;
}

export async function buildBudgetInsight(
  supabase: any, userId: string, companyId: string | null, catRefs: (string | null)[], type: string,
): Promise<string | null> {
  const info = await computeBudgetUsage(supabase, userId, companyId, catRefs, type);
  if (!info) return null;

  const { kind, cat, approvedUsed, pendingUsed, used, goal, day, daysInMonth } = info;
  const projected = (used / Math.max(day, 1)) * daysInMonth;
  const pct = Math.round((used / goal) * 100);
  const rest = goal - used;
  const daysLeft = daysInMonth - day;
  const detail = breakdownSuffix(approvedUsed, pendingUsed);

  if (kind === "income") {
    if (rest <= 0) return `🎯 Meta de faturamento de *${cat}* batida! ${brl(used)} de ${brl(goal)} (${pct}%)${detail} este mês. 👏`;
    return `🎯 *${cat}* tem meta de faturamento de ${brl(goal)}/mês. Você já soma ${brl(used)} (${pct}%)${detail} — faltam ${brl(rest)} em ${daysLeft} dias.\n` +
      (projected >= goal ? `No ritmo atual, fecha o mês em ~${brl(projected)} e bate a meta. ✅`
        : `No ritmo atual, fecha em ~${brl(projected)} — ${brl(goal - projected)} abaixo. Vale acelerar as vendas.`);
  }
  if (rest < 0) {
    return `🚨 *${cat}* estourou a meta: ${brl(used)} de ${brl(goal)} (${pct}%)${detail} — ${brl(-rest)} acima.\n` +
      `Se continuar assim, fecha o mês em ~${brl(projected)}. Sugestão: segurar novos gastos nessa categoria até o fim do mês.`;
  }
  const head = pct >= 70 ? `⚠️ Atenção: *${cat}*` : `📊 *${cat}*`;
  let msg = `${head} faz parte da sua meta de ${brl(goal)}/mês. Já soma ${brl(used)} (${pct}%)${detail} e restam ${brl(rest)} para ${daysLeft} dias.`;
  if (projected > goal) msg += `\nNo ritmo atual, vai fechar em ~${brl(projected)} — ${brl(projected - goal)} acima. Dá para gastar cerca de ${brl(rest / Math.max(daysLeft, 1))}/dia até o fim do mês.`;
  else msg += `\nNo ritmo atual, fecha em ~${brl(projected)}, dentro da meta. ✅`;
  return msg;
}

/**
 * Prévia imediata no WhatsApp quando o usuário envia um lançamento:
 * soma os lançamentos já aprovados (transactions) + pendentes de análise (ai_pending_transactions)
 * e, caso o lançamento atual ainda não tenha sido inserido (pendingAmount > 0), soma-o também.
 */
export async function buildPendingBudgetPreview(
  supabase: any,
  userId: string,
  companyId: string | null,
  catRefs: (string | null | undefined)[],
  type: string,
  pendingAmount: number,
  competenceDate?: string | null,
): Promise<string | null> {
  const info = await computeBudgetUsage(supabase, userId, companyId, catRefs, type);
  if (!info) return null;
  if (competenceDate && !competenceDate.startsWith(info.monthKey)) return null;

  const { kind, cat, approvedUsed, pendingUsed: existingPending, goal, day, daysInMonth } = info;
  const added = Math.abs(Number(pendingAmount) || 0);
  const totalPending = existingPending + added;
  const totalUsed = approvedUsed + totalPending;
  const pct = Math.round((totalUsed / goal) * 100);
  const rest = goal - totalUsed;
  const daysLeft = daysInMonth - day;
  const detail = breakdownSuffix(approvedUsed, totalPending);

  if (kind === "income") {
    if (rest <= 0) {
      return `🎯 *Meta de ${cat}:* já soma ${brl(totalUsed)} de ${brl(goal)} (${pct}%)${detail} — meta batida! 👏`;
    }
    return `🎯 *Meta de ${cat}:* soma ${brl(totalUsed)} de ${brl(goal)} (${pct}%)${detail} — faltam ${brl(rest)} em ${daysLeft} dias.`;
  }

  if (rest < 0) {
    return `🚨 *Atenção à meta de ${cat}:* soma ${brl(totalUsed)} de ${brl(goal)} (${pct}%)${detail} — *${brl(-rest)} acima da meta*.`;
  }
  if (pct >= 80) {
    return `⚠️ *Meta de ${cat}:* soma ${brl(totalUsed)} de ${brl(goal)} (${pct}%)${detail} — restam ${brl(rest)} para ${daysLeft} dias.`;
  }
  return `🎯 *Meta de ${cat}:* dentro da meta! Soma ${brl(totalUsed)} de ${brl(goal)} (${pct}%)${detail} — ainda cabem ${brl(rest)} este mês.`;
}

// Segunda mensagem "CFO": após um lançamento, avisa se a categoria tem meta orçamentária.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function shouldSendBudgetFollowUp(status: string, transactionId: string | null) {
  return status === "approved" && Boolean(transactionId);
}

export async function buildBudgetInsight(
  supabase: any, userId: string, companyId: string | null, catRefs: (string | null)[], type: string,
): Promise<string | null> {
  const kind = type === "receita" ? "income" : "expense";
  let q = supabase.from("budget_targets").select("category_name, target_amount").eq("user_id", userId).eq("kind", kind);
  q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
  const { data: targets, error: targetError } = await q;
  if (targetError) throw targetError;
  if (!targets?.length) return null;

  const { data: cats, error: categoryError } = await supabase.from("categories").select("id, name").eq("user_id", userId);
  if (categoryError) throw categoryError;
  const idToName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.name]));
  const resolve = (r: string | null) => (r ? (UUID_RE.test(r) ? idToName.get(r) || "" : r) : "");
  const txNames = catRefs.map(resolve).map(norm).filter(Boolean);
  const target = targets.find((t: any) => txNames.includes(norm(t.category_name)));
  if (!target) return null;

  const tName = norm(target.category_name);
  const ids = (cats || []).filter((c: any) => norm(c.name) === tName).map((c: any) => c.id);
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
  const { data: txs, error } = await ctx(supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", type)
    .gte("competence_date", start).lte("competence_date", end).or(orFilter));
  if (error) throw error;
  const used = (txs || []).reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);
  const goal = Number(target.target_amount) || 0;
  if (goal <= 0) return null;

  const day = now.getDate();
  const projected = (used / Math.max(day, 1)) * daysInMonth;
  const pct = Math.round((used / goal) * 100);
  const rest = goal - used;
  const daysLeft = daysInMonth - day;
  const cat = target.category_name;

  if (kind === "income") {
    if (rest <= 0) return `🎯 Meta de faturamento de *${cat}* batida! ${brl(used)} de ${brl(goal)} (${pct}%) este mês. 👏`;
    return `🎯 *${cat}* tem meta de faturamento de ${brl(goal)}/mês. Você já fez ${brl(used)} (${pct}%) — faltam ${brl(rest)} em ${daysLeft} dias.\n` +
      (projected >= goal ? `No ritmo atual, fecha o mês em ~${brl(projected)} e bate a meta. ✅`
        : `No ritmo atual, fecha em ~${brl(projected)} — ${brl(goal - projected)} abaixo. Vale acelerar as vendas.`);
  }
  if (rest < 0) {
    return `🚨 *${cat}* estourou a meta: ${brl(used)} de ${brl(goal)} (${pct}%) — ${brl(-rest)} acima.\n` +
      `Se continuar assim, fecha o mês em ~${brl(projected)}. Sugestão: segurar novos gastos nessa categoria até o fim do mês.`;
  }
  const head = pct >= 70 ? `⚠️ Atenção: *${cat}*` : `📊 *${cat}*`;
  let msg = `${head} faz parte da sua meta de ${brl(goal)}/mês. Já usou ${brl(used)} (${pct}%) e restam ${brl(rest)} para ${daysLeft} dias.`;
  if (projected > goal) msg += `\nNo ritmo atual, vai fechar em ~${brl(projected)} — ${brl(projected - goal)} acima. Dá para gastar cerca de ${brl(rest / Math.max(daysLeft, 1))}/dia até o fim do mês.`;
  else msg += `\nNo ritmo atual, fecha em ~${brl(projected)}, dentro da meta. ✅`;
  return msg;
}

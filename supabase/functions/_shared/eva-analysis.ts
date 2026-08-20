// Shared analytical engine for EVA (in-app chat + WhatsApp).
// Collects real aggregates from the user's data and asks the AI to write a
// specific, number-driven answer instead of a generic one.

export const ANALYSIS_MODEL = "google/gemini-2.5-pro";

export function fmtBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface CompanyLike {
  id: string;
  name: string;
  cnpj?: string | null;
}

export interface ResolvedContexts {
  /** null entry = "Pessoal" */
  companyIds: (string | null)[];
  labels: string[];
}

/**
 * Accepts a string, an array of strings, null or anything else the model may
 * hallucinate. Never throws (this is what caused
 * "contextName.toLowerCase is not a function").
 */
export function resolveContexts(
  input: unknown,
  companies: CompanyLike[],
  fallbackLabel = "Pessoal",
): ResolvedContexts {
  const raw: unknown[] = Array.isArray(input) ? input : [input];
  const names = raw
    .map((v) => (typeof v === "string" ? v : v && typeof v === "object" && "name" in (v as any) ? String((v as any).name) : ""))
    .map((s) => s.trim())
    .filter(Boolean);

  const list = names.length > 0 ? names : [fallbackLabel];

  const companyIds: (string | null)[] = [];
  const labels: string[] = [];

  for (const name of list) {
    const n = normalize(name);
    if (!n || n === "pessoal" || n === "pessoa fisica" || n === "pf") {
      if (!companyIds.includes(null)) {
        companyIds.push(null);
        labels.push("Pessoal");
      }
      continue;
    }
    if (n === "todos" || n === "todas" || n === "tudo" || n === "consolidado" || n === "geral") {
      if (!companyIds.includes(null)) {
        companyIds.push(null);
        labels.push("Pessoal");
      }
      for (const c of companies) {
        if (!companyIds.includes(c.id)) {
          companyIds.push(c.id);
          labels.push(c.name);
        }
      }
      continue;
    }
    const match =
      companies.find((c) => normalize(c.name) === n) ||
      companies.find((c) => normalize(c.name).includes(n) || n.includes(normalize(c.name))) ||
      companies.find((c) => c.cnpj && normalize(c.cnpj) === n);
    if (match) {
      if (!companyIds.includes(match.id)) {
        companyIds.push(match.id);
        labels.push(match.name);
      }
    }
  }

  if (companyIds.length === 0) {
    companyIds.push(null);
    labels.push("Pessoal");
  }

  return { companyIds, labels };
}

/** Single-context helper kept for legacy call sites. */
export function resolveSingleContext(input: unknown, companies: CompanyLike[]): string | null {
  return resolveContexts(input, companies).companyIds[0] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface AnalysisDataOptions {
  months?: number;
  topCategories?: number;
}

export interface AnalysisData {
  block: string;
  monthsCovered: number;
}

/**
 * Builds a compact, aggregated snapshot of the user's finances for the
 * selected contexts. Aggregates only — never row-by-row — so it fits in the
 * model context window.
 */
export async function buildAnalysisData(
  supabase: any,
  userId: string,
  contexts: ResolvedContexts,
  options: AnalysisDataOptions = {},
): Promise<AnalysisData> {
  const months = Math.min(Math.max(options.months ?? 12, 1), 24);
  const topCategories = options.topCategories ?? 30;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const horizon = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const horizonStr = `${horizon.getFullYear()}-${pad(horizon.getMonth() + 1)}-${pad(horizon.getDate())}`;

  const [txRes, catRes, accRes, cardRes, budgetRes, paidRes, pendingRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, type, status, payment_date, competence_date, category, subcategory, company_id, is_internal_transfer")
      .eq("user_id", userId)
      .gte("payment_date", startStr)
      .limit(20000),
    supabase.from("categories").select("id, name, type, parent_id, company_id").eq("user_id", userId),
    supabase.from("bank_accounts").select("id, name, initial_balance, company_id").eq("user_id", userId),
    supabase.from("credit_cards").select("id, name, limit, company_id").eq("user_id", userId),
    supabase.from("budget_targets").select("*").eq("user_id", userId).limit(500).then(
      (r: any) => r,
      () => ({ data: [] }),
    ),
    supabase
      .from("transactions")
      .select("amount, type, bank_account_id, company_id")
      .eq("user_id", userId)
      .eq("status", "Pago")
      .not("bank_account_id", "is", null)
      .limit(50000),
    supabase
      .from("transactions")
      .select("amount, type, payment_date, category, company_id, credit_card_id")
      .eq("user_id", userId)
      .eq("status", "Pendente")
      .gte("payment_date", todayStr)
      .lte("payment_date", horizonStr)
      .limit(5000),
  ]);


  const categories = catRes?.data || [];
  const catById = new Map<string, any>(categories.map((c: any) => [c.id, c]));
  const wanted = new Set(contexts.companyIds.map((id) => id ?? "__pessoal__"));

  const inScope = (companyId: string | null | undefined) =>
    wanted.has(companyId ?? "__pessoal__");

  const txs = (txRes?.data || []).filter(
    (t: any) => inScope(t.company_id) && !t.is_internal_transfer,
  );

  // Monthly series
  const monthly = new Map<string, { receita: number; despesa: number }>();
  const byCategory = new Map<string, { receita: number; despesa: number }>();

  for (const t of txs) {
    const date = String(t.payment_date || t.competence_date || "").slice(0, 7);
    if (!date) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    const bucket = monthly.get(date) || { receita: 0, despesa: 0 };
    if (t.type === "receita") bucket.receita += amount;
    else bucket.despesa += amount;
    monthly.set(date, bucket);

    const cat = catById.get(t.category);
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const name = parent ? `${parent.name} › ${cat.name}` : cat?.name || "Sem categoria";
    const cb = byCategory.get(name) || { receita: 0, despesa: 0 };
    if (t.type === "receita") cb.receita += amount;
    else cb.despesa += amount;
    byCategory.set(name, cb);
  }

  const monthKeys = [...monthly.keys()].sort();
  const monthlyLines = monthKeys.map((k) => {
    const m = monthly.get(k)!;
    return `  ${k}: entradas ${fmtBRL(m.receita)} | saídas ${fmtBRL(m.despesa)} | resultado ${fmtBRL(m.receita - m.despesa)}`;
  });

  const totalReceita = [...monthly.values()].reduce((s, m) => s + m.receita, 0);
  const totalDespesa = [...monthly.values()].reduce((s, m) => s + m.despesa, 0);
  const nMonths = Math.max(monthKeys.length, 1);

  const catLines = [...byCategory.entries()]
    .sort((a, b) => (b[1].despesa + b[1].receita) - (a[1].despesa + a[1].receita))
    .slice(0, topCategories)
    .map(([name, v]) => {
      const monthlyAvgOut = v.despesa / nMonths;
      return `  ${name}: saídas ${fmtBRL(v.despesa)} (média ${fmtBRL(monthlyAvgOut)}/mês)${v.receita > 0 ? ` | entradas ${fmtBRL(v.receita)}` : ""}`;
    });

  // Recurrence heuristic: category present in >= 70% of the months = fixed cost
  const catMonths = new Map<string, Set<string>>();
  for (const t of txs) {
    if (t.type !== "despesa") continue;
    const cat = catById.get(t.category);
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const name = parent ? `${parent.name} › ${cat.name}` : cat?.name || "Sem categoria";
    const mk = String(t.payment_date || "").slice(0, 7);
    if (!mk) continue;
    const set = catMonths.get(name) || new Set<string>();
    set.add(mk);
    catMonths.set(name, set);
  }
  const fixed: string[] = [];
  const variable: string[] = [];
  for (const [name, v] of byCategory.entries()) {
    if (v.despesa <= 0) continue;
    const presence = (catMonths.get(name)?.size || 0) / nMonths;
    const line = `${name} (${fmtBRL(v.despesa / nMonths)}/mês)`;
    if (presence >= 0.7) fixed.push(line);
    else variable.push(line);
  }

  const fixedTotal = [...byCategory.entries()]
    .filter(([name, v]) => v.despesa > 0 && (catMonths.get(name)?.size || 0) / nMonths >= 0.7)
    .reduce((s, [, v]) => s + v.despesa / nMonths, 0);
  const variableTotal = totalDespesa / nMonths - fixedTotal;

  // Taxes heuristic
  const taxNames = ["imposto", "tribut", "das", "simples", "iss", "irpj", "csll", "pis", "cofins", "inss"];
  const taxMonthly = [...byCategory.entries()]
    .filter(([name]) => taxNames.some((t) => normalize(name).includes(t)))
    .reduce((s, [, v]) => s + v.despesa / nMonths, 0);
  const taxRate = totalReceita > 0 ? (taxMonthly * nMonths / totalReceita) * 100 : 0;

  const accounts = (accRes?.data || []).filter((a: any) => inScope(a.company_id));
  const cards = (cardRes?.data || []).filter((c: any) => inScope(c.company_id));
  const budgets = (budgetRes?.data || []).filter((b: any) => inScope(b.company_id));

  // Saldos por conta (saldo inicial + movimentos pagos vinculados à conta)
  const movByAccount = new Map<string, number>();
  for (const t of paidRes?.data || []) {
    const id = t.bank_account_id as string;
    if (!id) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    movByAccount.set(id, (movByAccount.get(id) || 0) + (t.type === "receita" ? amount : -amount));
  }
  const accountBalances = accounts.map((a: any) => ({
    name: a.name,
    balance: Number(a.initial_balance || 0) + (movByAccount.get(a.id) || 0),
  }));
  const cashTotal = accountBalances.reduce((s, a) => s + a.balance, 0);

  // Compromissos futuros (3 meses)
  const pending = (pendingRes?.data || []).filter((t: any) => inScope(t.company_id));
  const pendingByMonth = new Map<string, { receita: number; despesa: number }>();
  for (const t of pending) {
    const mk = String(t.payment_date || "").slice(0, 7);
    if (!mk) continue;
    const b = pendingByMonth.get(mk) || { receita: 0, despesa: 0 };
    const amount = Math.abs(Number(t.amount) || 0);
    if (t.type === "receita") b.receita += amount;
    else b.despesa += amount;
    pendingByMonth.set(mk, b);
  }
  const pendingLines = [...pendingByMonth.entries()].sort().map(
    ([k, v]) => `  ${k}: a receber ${fmtBRL(v.receita)} | a pagar ${fmtBRL(v.despesa)}`,
  );

  // Uso de cartão (lançamentos vinculados a cartão, pagos + pendentes no período)
  const cardUse = new Map<string, number>();
  for (const t of pending) {
    if (!t.credit_card_id || t.type === "receita") continue;
    cardUse.set(t.credit_card_id, (cardUse.get(t.credit_card_id) || 0) + Math.abs(Number(t.amount) || 0));
  }
  const cardLines = cards.map((c: any) => {
    const limit = Number(c.limit || 0);
    const used = cardUse.get(c.id) || 0;
    return `  ${c.name}: limite ${limit > 0 ? fmtBRL(limit) : "não informado"} | faturas futuras em aberto ${fmtBRL(used)}${limit > 0 ? ` (${((used / limit) * 100).toFixed(0)}% do limite)` : ""}`;
  });

  // Tendência: últimos 3 meses x período completo
  const last3 = monthKeys.slice(-3);
  const l3Receita = last3.reduce((s, k) => s + (monthly.get(k)?.receita || 0), 0) / Math.max(last3.length, 1);
  const l3Despesa = last3.reduce((s, k) => s + (monthly.get(k)?.despesa || 0), 0) / Math.max(last3.length, 1);
  const avgReceita = totalReceita / nMonths;
  const avgDespesa = totalDespesa / nMonths;
  const margin = totalReceita > 0 ? ((totalReceita - totalDespesa) / totalReceita) * 100 : 0;
  const l3Margin = l3Receita > 0 ? ((l3Receita - l3Despesa) / l3Receita) * 100 : 0;
  const runway = fixedTotal > 0 ? cashTotal / fixedTotal : 0;

  // Retiradas de sócio / pró-labore
  const proNames = ["pro-labore", "pro labore", "prolabore", "socio", "sócio", "retirada", "distribuicao de lucro", "distribuição de lucro"];
  const proLines = [...byCategory.entries()]
    .filter(([name]) => proNames.some((p) => normalize(name).includes(normalize(p))))
    .map(([name, v]) => `  ${name}: ${fmtBRL(v.despesa / nMonths)}/mês`);
  const proTotal = [...byCategory.entries()]
    .filter(([name]) => proNames.some((p) => normalize(name).includes(normalize(p))))
    .reduce((s, [, v]) => s + v.despesa / nMonths, 0);

  const budgetLines = budgets.slice(0, 40).map((b: any) => {
    return `  ${b.category_name || "—"}: meta ${fmtBRL(Number(b.target_amount ?? 0))}${b.kind ? ` (${b.kind})` : ""}`;
  });

  const block = `
=== DADOS REAIS DO USUÁRIO (use SOMENTE estes números) ===
Contextos analisados: ${contexts.labels.join(" + ")}
Período: últimos ${nMonths} meses (${monthKeys[0] || "—"} a ${monthKeys[monthKeys.length - 1] || "—"})
Data de hoje: ${todayStr}

TOTAIS DO PERÍODO
  Entradas: ${fmtBRL(totalReceita)} (média ${fmtBRL(avgReceita)}/mês)
  Saídas:   ${fmtBRL(totalDespesa)} (média ${fmtBRL(avgDespesa)}/mês)
  Resultado: ${fmtBRL(totalReceita - totalDespesa)} (média ${fmtBRL((totalReceita - totalDespesa) / nMonths)}/mês)
  Margem do período: ${margin.toFixed(1)}%

TENDÊNCIA (últimos 3 meses vs média do período)
  Entradas: ${fmtBRL(l3Receita)}/mês (média do período ${fmtBRL(avgReceita)}/mês)
  Saídas: ${fmtBRL(l3Despesa)}/mês (média do período ${fmtBRL(avgDespesa)}/mês)
  Margem dos últimos 3 meses: ${l3Margin.toFixed(1)}%

SÉRIE MENSAL
${monthlyLines.join("\n") || "  Sem movimentação"}

ESTRUTURA DE CUSTOS (médias mensais, classificação por recorrência)
  Custos fixos (presentes em ≥70% dos meses): ${fmtBRL(fixedTotal)}/mês
${fixed.length ? "    - " + fixed.slice(0, 20).join("\n    - ") : "    (nenhum)"}
  Custos variáveis: ${fmtBRL(Math.max(variableTotal, 0))}/mês
${variable.length ? "    - " + variable.slice(0, 20).join("\n    - ") : "    (nenhum)"}
  Impostos identificados: ${fmtBRL(taxMonthly)}/mês (≈ ${taxRate.toFixed(1)}% da receita do período)

RETIRADAS / PRÓ-LABORE IDENTIFICADOS
${proLines.join("\n") || "  Nenhuma categoria de pró-labore/retirada identificada nos dados"}
  Total de retiradas: ${fmtBRL(proTotal)}/mês

CAIXA E FÔLEGO
  Caixa total nas contas: ${fmtBRL(cashTotal)}
${accountBalances.map((a) => `    - ${a.name}: ${fmtBRL(a.balance)}`).join("\n") || "    (nenhuma conta cadastrada)"}
  Cobertura de custos fixos com o caixa atual: ${fixedTotal > 0 ? `${runway.toFixed(1)} meses` : "não calculável (sem custos fixos identificados)"}

CARTÕES
${cardLines.join("\n") || "  nenhum"}

COMPROMISSOS FUTUROS (pendentes até ${horizonStr})
${pendingLines.join("\n") || "  Nenhum lançamento pendente futuro"}

TOP CATEGORIAS
${catLines.join("\n") || "  Sem dados"}

METAS ORÇAMENTÁRIAS CADASTRADAS
${budgetLines.join("\n") || "  Nenhuma meta cadastrada"}
=== FIM DOS DADOS ===`.trim();


  return { block, monthsCovered: nMonths };
}

export interface RunAnalysisArgs {
  apiKey: string;
  question: string;
  dataBlock: string;
  channel: "app" | "whatsapp";
  analysisType?: string | null;
  targetAmount?: number | null;
  history?: { role: string; content: string }[];
}

export interface RunAnalysisResult {
  ok: boolean;
  text?: string;
  status?: number;
  error?: string;
}

export async function runAnalysis(args: RunAnalysisArgs): Promise<RunAnalysisResult> {
  const { apiKey, question, dataBlock, channel, analysisType, targetAmount, history = [] } = args;

  const formatRules =
    channel === "whatsapp"
      ? `FORMATO (WhatsApp): texto enxuto, use *negrito* do WhatsApp, listas curtas com "•", sem markdown de títulos, máximo ~15 linhas.`
      : `FORMATO (chat do app): markdown, use **negrito**, títulos curtos e listas. Máximo ~25 linhas.`;

  const system = `Você é a EVA, analista financeira do EVA OS. Você TEM os dados reais do usuário abaixo.

REGRAS INEGOCIÁVEIS:
1. NUNCA responda "não consigo te dar um número exato", "depende de vários fatores" ou peça para o usuário reunir dados. Você já tem os dados.
2. SEMPRE comece pela resposta direta: o número/conclusão em uma frase.
3. Depois mostre a MEMÓRIA DE CÁLCULO passo a passo, com os valores reais usados.
4. Termine com 2 a 4 recomendações práticas e específicas (cite categorias e valores reais).
5. Se faltar um dado essencial (ex.: regime tributário, pró-labore), ADOTE uma premissa razoável, marque-a explicitamente como "premissa: ..." e faça o cálculo mesmo assim. No máximo UMA pergunta objetiva no final.
6. Use apenas os números do bloco de dados. Não invente valores. Se algo não existe nos dados, diga isso e use a premissa.
7. Português do Brasil, valores em R$ formatados.
${analysisType ? `8. Tipo de análise solicitada: ${analysisType}.` : ""}
${targetAmount ? `9. Valor-alvo informado pelo usuário: ${fmtBRL(targetAmount)}.` : ""}

${formatRules}

${dataBlock}`;

  const messages = [
    { role: "system", content: system },
    ...history.slice(-6),
    { role: "user", content: question },
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: 2500,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("EVA analysis gateway error:", res.status, errText);
    if (res.status === 429) {
      return { ok: false, status: 429, error: "Muitas solicitações agora. Tente de novo em instantes." };
    }
    if (res.status === 402) {
      return { ok: false, status: 402, error: "Créditos de IA esgotados. Adicione créditos para continuar." };
    }
    return { ok: false, status: res.status, error: "Não consegui concluir a análise agora." };
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) return { ok: false, status: 500, error: "A análise voltou vazia. Tente reformular a pergunta." };
  return { ok: true, text };
}

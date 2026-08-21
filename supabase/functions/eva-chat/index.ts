import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCreditCardDueDate, getInstallmentDueDate } from "../_shared/creditCardDueDate.ts";
import { resolveContexts, buildAnalysisData, runAnalysis, runCfoReading } from "../_shared/eva-analysis.ts";
import { buildBudgetMonthReport, formatBudgetMonthMessage } from "../_shared/budgetMonthReport.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão de Débito",
  cartao_credito: "Cartão de Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, companyId: requestedCompanyId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use anon key client to validate JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // === Plan limit enforcement: AI monthly quota ===
    try {
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, plan:subscription_plans(monthly_ai_messages)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const inTrial = subRow?.status === "trialing" && subRow.trial_ends_at && new Date(subRow.trial_ends_at).getTime() > Date.now();
      const monthlyLimit: number | null = inTrial ? 500 : (subRow?.plan as any)?.monthly_ai_messages ?? 100;

      if (monthlyLimit != null) {
        const period = new Date().toISOString().slice(0, 7);
        const { data: usageRow } = await supabase
          .from("ai_usage_counters")
          .select("messages_used")
          .eq("user_id", userId)
          .eq("period_year_month", period)
          .maybeSingle();
        const used = (usageRow as any)?.messages_used ?? 0;
        if (used >= monthlyLimit) {
          return new Response(
            JSON.stringify({ error: `Cota mensal de ${monthlyLimit} mensagens da EVA atingida. Faça upgrade do plano para continuar.` }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (quotaErr) {
      console.error("Quota check failed (allowing request):", quotaErr);
    }

    // Fetch user context (same as whatsapp-webhook)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

    const [categoriesRes, accountsRes, walletsRes, companiesRes, creditCardsRes, suppliersRes, clientsRes, recentTxRes, historyTxRes] = await Promise.all([
      supabase.from("categories").select("id, name, type, parent_id, company_id").eq("user_id", userId),
      supabase.from("bank_accounts").select("id, name, type, company_id").eq("user_id", userId),
      supabase.from("wallets").select("id, name, company_id").eq("user_id", userId),
      supabase.from("companies").select("id, name, cnpj").eq("user_id", userId),
      supabase.from("credit_cards").select("id, name, last_four_digits, closing_day, due_day, company_id, bank_account_id").eq("user_id", userId),
      supabase.from("suppliers").select("id, name").eq("user_id", userId),
      supabase.from("clients").select("id, name").eq("user_id", userId),
      supabase.from("transactions").select("id, description, amount, type, status, payment_date, category, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("transactions").select("id, description, amount, type, category, contact_name, supplier_id, client_id, company_id, payment_method, bank_account_id, wallet_id, credit_card_id, payment_date").eq("user_id", userId).gte("payment_date", ninetyDaysAgoStr).order("payment_date", { ascending: false }).limit(1000),
    ]);

    const categories = categoriesRes.data || [];
    const accounts = accountsRes.data || [];
    const wallets = walletsRes.data || [];
    const companies = companiesRes.data || [];
    const creditCards = creditCardsRes.data || [];
    const suppliersList = suppliersRes.data || [];
    const clientsList = clientsRes.data || [];
    const recentTransactions = recentTxRes.data || [];
    const historicalTransactions = historyTxRes.data || [];

    const pad = (n: number) => String(n).padStart(2, "0");
    const todayNow = new Date();
    const today = `${todayNow.getFullYear()}-${pad(todayNow.getMonth() + 1)}-${pad(todayNow.getDate())}`;

    // Build context-aware lists (same logic as whatsapp-webhook)
    const contextNames = ["Pessoal", ...companies.map((c: any) => c.name)];

    const buildCategoryList = (companyId: string | null, label: string) => {
      const filtered = categories.filter((c: any) => c.company_id === companyId);
      const parents = filtered.filter((c: any) => !c.parent_id);
      if (parents.length === 0) return "";
      const lines = parents.map((p: any) => {
        const subs = filtered
          .filter((c: any) => c.parent_id === p.id)
          .map((c: any) => {
            const level3 = filtered.filter((l3: any) => l3.parent_id === c.id).map((l3: any) => `${l3.name}[${l3.id}]`);
            return level3.length > 0 ? `${c.name}[${c.id}] > ${level3.join(", ")}` : `${c.name}[${c.id}]`;
          });
        const typeTag = p.type === "receita" ? "RECEITA" : p.type === "despesa" ? "DESPESA" : "AMBOS";
        return subs.length > 0 ? `  ${p.name}[${p.id}] (${typeTag}) > ${subs.join("; ")}` : `  ${p.name}[${p.id}] (${typeTag})`;
      });
      return `[${label}]\n${lines.join("\n")}`;
    };

    const buildAccountList = (companyId: string | null, label: string) => {
      const ctxAccounts = accounts.filter((a: any) => a.company_id === companyId);
      const ctxWallets = wallets.filter((w: any) => w.company_id === companyId);
      const ctxCards = creditCards.filter((c: any) => c.company_id === companyId);
      const parts: string[] = [];
      if (ctxAccounts.length > 0) parts.push("Contas: " + ctxAccounts.map((a: any) => `${a.name}[${a.id}]`).join(", "));
      if (ctxWallets.length > 0) parts.push("Carteiras: " + ctxWallets.map((w: any) => `${w.name}[${w.id}]`).join(", "));
      if (ctxCards.length > 0) parts.push("Cartões de Crédito: " + ctxCards.map((c: any) => `${c.name}${c.last_four_digits ? ` Final ${c.last_four_digits}` : ""}[${c.id}]`).join(", "));
      if (parts.length === 0) return "";
      return `[${label}] ${parts.join(" | ")}`;
    };

    const buildContactList = () => {
      const parts: string[] = [];
      if (suppliersList.length > 0) parts.push("FORNECEDORES: " + suppliersList.map((s: any) => `${s.name}[${s.id}]`).join(", "));
      if (clientsList.length > 0) parts.push("CLIENTES: " + clientsList.map((c: any) => `${c.name}[${c.id}]`).join(", "));
      return parts.join("\n");
    };

    const categoryListByContext = [
      buildCategoryList(null, "Pessoal"),
      ...companies.map((c: any) => buildCategoryList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const accountListByContext = [
      buildAccountList(null, "Pessoal"),
      ...companies.map((c: any) => buildAccountList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const contactList = buildContactList();

    // Build historical patterns
    const buildHistoricalPatterns = () => {
      if (historicalTransactions.length === 0) return "";
      const patterns = new Map<string, { category: string; categoryName: string; companyId: string | null; count: number }>();
      for (const tx of historicalTransactions) {
        const key = normalizeText(tx.contact_name || tx.description);
        if (!key || key.length < 3) continue;
        const existing = patterns.get(key);
        const catObj = categories.find((c: any) => c.id === tx.category);
        const catName = catObj?.name || tx.category;
        if (existing) { existing.count++; }
        else {
          patterns.set(key, { category: tx.category, categoryName: catName, companyId: tx.company_id, count: 1 });
        }
      }
      const sorted = [...patterns.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 50);
      if (sorted.length === 0) return "";
      const lines = sorted.map(([key, p]) => {
        const contextLabel = p.companyId ? companies.find((c: any) => c.id === p.companyId)?.name || "Empresa" : "Pessoal";
        return `  "${key}" → Categoria: ${p.categoryName}[${p.category}] | Contexto: ${contextLabel} | Usado ${p.count}x`;
      });
      return `\nPADRÕES HISTÓRICOS DO USUÁRIO (últimos 90 dias — USE COMO REFERÊNCIA PRIORITÁRIA):\n${lines.join("\n")}`;
    };

    const historicalPatternsBlock = buildHistoricalPatterns();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve active context selected in the UI (from CompanyContext)
    const activeCompany = requestedCompanyId
      ? companies.find((c: any) => c.id === requestedCompanyId)
      : null;
    const activeContextName = activeCompany ? activeCompany.name : "Pessoal";

    // Build system prompt (same as whatsapp-webhook but adapted for in-app chat)
    const systemPrompt = `Você é a EVA, assistente financeira inteligente do EVA OS. O usuário está conversando com você dentro do sistema web. Analise a mensagem e classifique a intenção.

IMPORTANTE: Você está dentro do sistema, então pode executar ações diretamente. NÃO precisa de confirmações via pending_actions. Execute as ações e retorne o resultado.

CONTEXTO ATIVO NO MOMENTO: "${activeContextName}"
- Se o usuário NÃO mencionar explicitamente outro contexto, USE SEMPRE "${activeContextName}" no campo "context".
- Só troque para outro contexto se o usuário citar o nome dele.

REGRAS:
1. Classifique como: "lancamento", "editar_lancamento", "consulta", "analise", "gerenciar_categoria" ou "conversa"
2. Para lançamentos: extraia TODOS os campos possíveis da mensagem E do contexto da conversa
3. Para consultas: identifique o tipo e contexto
4. Para gerenciar categorias: identifique a ação solicitada
5. Responda SEMPRE em português brasileiro
6. Retorne APENAS um JSON válido, sem texto adicional

REGRA CRÍTICA — PERGUNTAS SEMPRE VIRAM "consulta", NUNCA "conversa":
- "Quanto gastei em X?" / "Quanto recebi de Y?" → intent="consulta", query_type="gastos_categoria", category_filter="X" (X pode ser categoria OU estabelecimento — o backend tenta ambos)
- "Qual meu saldo?" → query_type="saldo"
- "Resumo do mês" / "Como foi meu mês?" → query_type="resumo_mes"
- "O que tenho a pagar?" / "Pendentes" → query_type="pendentes"
- "Como estão minhas metas do mês?" / "Estou dentro do orçamento?" / "Quanto ainda posso gastar?" → query_type="metas_mes"
- "Quanto gastei esse mês?" (sem categoria) → query_type="gastos_mes"
- NUNCA responda "não tenho essa informação" — dispare a consulta apropriada.

REGRA CRÍTICA — PERGUNTAS ANALÍTICAS VIRAM "analise", NUNCA "conversa":
Use intent="analise" sempre que a pergunta exigir raciocínio/cálculo sobre os dados, por exemplo:
- "Quanto preciso faturar bruto pra tirar X líquido?" → analysis_type="faturamento_necessario", target_amount=X
- "Qual minha estrutura de custos?" / "Qual minha margem?" / "Ponto de equilíbrio" → analysis_type="estrutura_custos"
- "Onde posso cortar X reais?" → analysis_type="onde_cortar", target_amount=X
- "Compare este ano com o ano passado" / "Compare as empresas" → analysis_type="comparativo"
- "Como estou frente às minhas metas?" → analysis_type="meta_vs_realizado"
- "Posso contratar alguém?" / "Vale a pena?" / qualquer pergunta de decisão financeira → analysis_type="diagnostico"
- Se o usuário pedir para avaliar MAIS DE UM contexto junto ("X e Y como se fossem uma empresa só"), preencha "contexts" com TODOS os nomes.
- NUNCA responda que "depende de vários fatores" ou que precisa reunir dados: classifique como "analise" que o backend te entrega os números reais.

Para análise:
{"intent":"analise","analysis_type":"faturamento_necessario|estrutura_custos|onde_cortar|comparativo|meta_vs_realizado|diagnostico","contexts":["Pessoal"],"months":12,"target_amount":0,"question":"reescreva a pergunta do usuário de forma completa e autocontida"}
- "months": quantos meses de histórico considerar (padrão 12, máximo 24; use 24 para comparações anuais).

CONTEXTOS DISPONÍVEIS (use EXATAMENTE um destes valores no campo "context"):
${contextNames.map((n) => `  - "${n}"`).join("\n")}
- "Pessoal" é para finanças pessoais do usuário
${companies.map((c: any) => `- "${c.name}" (CNPJ: ${c.cnpj}) é uma empresa do usuário`).join("\n")}
- Se o usuário NÃO especificar o contexto, use "${activeContextName}"

CATEGORIAS POR CONTEXTO (formato: Nome[UUID] (TIPO)):
${categoryListByContext || "Nenhuma categoria cadastrada"}

REGRA DE TIPO: 
- Se type="receita", escolha APENAS categorias marcadas como RECEITA ou AMBOS
- Se type="despesa", escolha APENAS categorias marcadas como DESPESA ou AMBOS

REGRA CRÍTICA DE CATEGORIA:
- Se NENHUMA categoria da lista acima se encaixar, retorne category_id como null e preencha "suggested_category_name".
- NÃO invente UUIDs.

CONTAS, CARTEIRAS E CARTÕES DE CRÉDITO POR CONTEXTO:
${accountListByContext || "Nenhuma conta cadastrada"}

${contactList ? `CONTATOS DO USUÁRIO:\n${contactList}` : ""}

MÉTODOS DE PAGAMENTO VÁLIDOS:
- "pix", "dinheiro", "cartao_debito", "cartao_credito", "boleto", "transferencia"

DATA ATUAL: ${today}

FORMATO DE RESPOSTA (JSON):
Para lançamento:
{"intent":"lancamento","description":"...","amount":0.00,"type":"receita|despesa","category_id":"UUID-ou-null","subcategory_id":"UUID-ou-null","suggested_category_name":"nome ou null","context":"Pessoal|Nome","account_id":"UUID-ou-null","credit_card_id":"UUID-ou-null","payment_method":"...|null","contact_name":"...|null","supplier_id":"UUID-ou-null","client_id":"UUID-ou-null","competence_date":"YYYY-MM-DD","payment_date":"YYYY-MM-DD-ou-null","status":"Pago|Pendente","notes":"...|null","date":"YYYY-MM-DD","installments":1,"installment_details":null,"friendly_message":"..."}

Para gerenciamento de categorias:
{"intent":"gerenciar_categoria","action":"criar|criar_subcategoria|renomear|mover|excluir","category_name":"...","category_id":"UUID","new_name":"...","parent_category_id":"UUID|null","new_parent_category_id":"UUID|null","category_type":"receita|despesa|ambos","context":"Pessoal|Nome","friendly_message":"..."}

Para consulta:
{"intent":"consulta","query_type":"saldo|resumo_mes|gastos_mes|receitas_mes|pendentes|gastos_categoria|listar_lancamentos|listar_cartoes|listar_contas|metas_mes","category_filter":"...","contact_filter":"...|null","period_filter":"mes_atual|mes_passado|ultimos_7_dias|ultimos_30_dias|ultimos_90_dias|ano_atual|ano_passado|null","context":"Pessoal|Nome","friendly_message":"..."}

REGRA DE PERÍODO — PRESTE MUITA ATENÇÃO:
- Se o usuário diz "ano", "anual", "este ano", "2025", "2026" → use "ano_atual" ou "ano_passado"
- Se o usuário diz "mês", "mensal", "este mês" → use "mes_atual"
- NUNCA responda com dados mensais quando o usuário pediu dados anuais
- Se o usuário corrigir o período (ex: "perguntei ano não mês"), use o período correto imediatamente

Para editar lançamento:
{"intent":"editar_lancamento","transaction_id":"UUID-ou-null","field":"amount|description|category|payment_date|competence_date|status|notes","new_value":"...","friendly_message":"..."}

LANÇAMENTOS RECENTES:
${recentTransactions.length > 0 ? recentTransactions.map((t: any) => `  - [${t.id}] ${t.description} | ${fmt(t.amount)} | ${t.type} | ${t.status} | ${t.payment_date}`).join("\n") : "Nenhum"}

Para conversa:
{"intent":"conversa","friendly_message":"..."}

IMPORTANTE:
- amount sempre positivo
- Data padrão: ${today}
- Sem tipo explícito → "despesa"
- Sempre retorne "context"
- Se o contexto tem APENAS UMA conta, use essa conta automaticamente
- Se tem MÚLTIPLAS e o usuário não especificou, pergunte no friendly_message

REGRA — contact_name: SEMPRE preencha com o nome do estabelecimento quando identificável.
REGRA — ESTABELECIMENTO NÃO É CATEGORIA.
${historicalPatternsBlock}`;

    // First, call AI non-streaming to get the JSON response
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Increment AI usage counter (best-effort, never fails the request)
    supabase.rpc("increment_ai_usage", { _uid: userId }).then(({ error }) => {
      if (error) console.error("increment_ai_usage failed:", error);
    });

    // Parse AI JSON response
    const parseJsonRobust = (text: string): any => {
      try { return JSON.parse(text.trim()); } catch {}
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) { try { return JSON.parse(codeBlockMatch[1].trim()); } catch {} }
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try { return JSON.parse(text.substring(firstBrace, lastBrace + 1)); } catch {}
      }
      if (firstBrace !== -1) {
        let partial = text.substring(firstBrace);
        partial = partial.replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
        let openBraces = 0, openBrackets = 0;
        for (const ch of partial) {
          if (ch === "{") openBraces++;
          else if (ch === "}") openBraces--;
          else if (ch === "[") openBrackets++;
          else if (ch === "]") openBrackets--;
        }
        partial += "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
        try { return JSON.parse(partial); } catch {}
      }
      return null;
    };

    const aiParsed = parseJsonRobust(rawContent);
    if (!aiParsed) {
      const cleanText = rawContent.replace(/```[\s\S]*?```/g, "").trim();
      return new Response(JSON.stringify({
        reply: cleanText || "Desculpe, não consegui entender. Pode reformular?",
        action: null,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Resolve context (defensive: aceita string, array ou null) ---
    const resolveContext = (contextName: unknown): string | null => {
      const first = Array.isArray(contextName) ? contextName[0] : contextName;
      if (!first || typeof first !== "string") return null;
      return resolveContexts(first, companies as any).companyIds[0] ?? null;
    };

    // === ANÁLISE (resposta detalhada com dados reais) ===
    if (aiParsed.intent === "analise") {
      const ctxInput = aiParsed.contexts ?? aiParsed.context ?? activeContextName;
      const contexts = resolveContexts(ctxInput, companies as any, activeContextName);
      const analysisData = await buildAnalysisData(supabase, userId, contexts, {
        months: Number(aiParsed.months) || 12,
      });
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const result = await runAnalysis({
        apiKey: LOVABLE_API_KEY,
        question: String(aiParsed.question || lastUser?.content || "").slice(0, 4000),
        dataBlock: analysisData.block,
        channel: "app",
        analysisType: aiParsed.analysis_type || null,
        targetAmount: Number(aiParsed.target_amount) || null,
        history: messages.slice(-6).map((m: any) => ({ role: m.role, content: String(m.content || "") })),
      });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ reply: result.text, action: "analysis" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === EXECUTE ACTION ===
    if (aiParsed.intent === "lancamento") {
      const companyId = resolveContext(aiParsed.context);
      const txType = aiParsed.type === "receita" ? "receita" : "despesa";
      const typeMatches = (cat: any) => !cat.type || cat.type === "ambos" || cat.type === txType;

      let contextCategories = categories.filter((c: any) => companyId ? c.company_id === companyId : !c.company_id);

      // Resolve category
      let matchedCategory: any = null;
      let subcategoryValue: string | null = null;

      if (aiParsed.category_id) {
        matchedCategory = contextCategories.find((c: any) => c.id === aiParsed.category_id && !c.parent_id);
        if (!matchedCategory) {
          const asSub = contextCategories.find((c: any) => c.id === aiParsed.category_id && c.parent_id);
          if (asSub) {
            matchedCategory = contextCategories.find((c: any) => c.id === asSub.parent_id);
            subcategoryValue = asSub.id;
          }
        }
        // Fallback: try by name
        if (!matchedCategory) {
          const nameGuess = aiParsed.category_id.toLowerCase();
          matchedCategory = contextCategories.find((c: any) => !c.parent_id && c.name.toLowerCase().includes(nameGuess) && typeMatches(c));
        }
      }

      // Historical reuse if no match
      if (!matchedCategory && historicalTransactions.length > 0) {
        const aiContact = normalizeText(aiParsed.contact_name);
        const aiDescription = normalizeText(aiParsed.description);
        for (const htx of historicalTransactions) {
          const htxContact = normalizeText(htx.contact_name);
          const htxDesc = normalizeText(htx.description);
          let isMatch = false;
          if (aiContact && aiContact.length >= 4 && htxContact && (aiContact.includes(htxContact) || htxContact.includes(aiContact))) isMatch = true;
          if (!isMatch && aiDescription && htxDesc && aiDescription.length >= 5) {
            const tokens = aiDescription.split(" ").filter((t: string) => t.length >= 4);
            const htxTokens = new Set(htxDesc.split(" ").filter((t: string) => t.length >= 4));
            const overlap = tokens.filter((t: string) => htxTokens.has(t));
            if (overlap.length >= 2) isMatch = true;
          }
          if (isMatch && (htx.company_id || null) === (companyId || null)) {
            const histCat = contextCategories.find((c: any) => c.id === htx.category);
            if (histCat && typeMatches(histCat)) {
              if (histCat.parent_id) {
                const parent = contextCategories.find((c: any) => c.id === histCat.parent_id);
                if (parent) { matchedCategory = parent; subcategoryValue = histCat.id; }
              } else { matchedCategory = histCat; }
              if (matchedCategory) break;
            }
          }
        }
      }

      // If still no category and suggested_category_name, create it
      if (!matchedCategory && aiParsed.suggested_category_name) {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ user_id: userId, name: aiParsed.suggested_category_name, type: txType, company_id: companyId })
          .select("id, name").single();
        if (newCat) matchedCategory = newCat;
      }

      if (!matchedCategory) {
        return new Response(JSON.stringify({
          reply: aiParsed.friendly_message || `Não encontrei uma categoria adequada. Crie uma categoria de ${txType} primeiro.`,
          action: null,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Resolve account
      const contextAccounts = accounts.filter((a: any) => companyId ? a.company_id === companyId : !a.company_id);
      const contextWallets = wallets.filter((w: any) => companyId ? w.company_id === companyId : !w.company_id);
      const contextCards = creditCards.filter((c: any) => companyId ? c.company_id === companyId : !c.company_id);

      let bankAccountId: string | null = null;
      let walletId: string | null = null;
      let creditCardId: string | null = null;
      let paymentMethod: string | null = aiParsed.payment_method || null;

      if (paymentMethod && PAYMENT_METHOD_MAP[paymentMethod]) paymentMethod = PAYMENT_METHOD_MAP[paymentMethod];

      if (aiParsed.credit_card_id) {
        const cardMatch = contextCards.find((c: any) => c.id === aiParsed.credit_card_id);
        if (cardMatch) { creditCardId = cardMatch.id; bankAccountId = cardMatch.bank_account_id; paymentMethod = "Cartão de Crédito"; }
      }
      if (!creditCardId && paymentMethod === "Cartão de Crédito" && contextCards.length === 1) {
        creditCardId = contextCards[0].id;
        bankAccountId = contextCards[0].bank_account_id;
      }

      if (!creditCardId) {
        if (aiParsed.account_id) {
          const accMatch = contextAccounts.find((a: any) => a.id === aiParsed.account_id);
          if (accMatch) bankAccountId = accMatch.id;
          else {
            const walMatch = contextWallets.find((w: any) => w.id === aiParsed.account_id);
            if (walMatch) walletId = walMatch.id;
          }
        }
        if (!bankAccountId && !walletId) {
          const total = contextAccounts.length + contextWallets.length;
          if (total === 1) {
            if (contextAccounts.length === 1) bankAccountId = contextAccounts[0].id;
            else walletId = contextWallets[0].id;
          } else if (total > 1) {
            const optionsList = [...contextAccounts.map((a: any) => `• ${a.name}`), ...contextWallets.map((w: any) => `• ${w.name} (carteira)`)].join("\n");
            return new Response(JSON.stringify({
              reply: `Entendi o lançamento de ${fmt(aiParsed.amount || 0)} — "${aiParsed.description}"\n\nMas em qual conta devo registrar?\n\n${optionsList}`,
              action: null,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }

      // Resolve contacts
      let supplierId: string | null = null;
      let clientId: string | null = null;
      let contactName = aiParsed.contact_name || null;
      if (aiParsed.supplier_id) {
        const s = suppliersList.find((s: any) => s.id === aiParsed.supplier_id);
        if (s) { supplierId = s.id; contactName = contactName || s.name; }
      }
      if (aiParsed.client_id) {
        const c = clientsList.find((c: any) => c.id === aiParsed.client_id);
        if (c) { clientId = c.id; contactName = contactName || c.name; }
      }

      // Auto-resolve / auto-create supplier or client by name
      try {
        const canonicalName = (aiParsed.contact_name || contactName || "").trim();
        if (canonicalName && canonicalName.length >= 2) {
          const norm = normalizeText(canonicalName);
          if (txType === "despesa" && !supplierId) {
            const fuzzy = suppliersList.find((s: any) => {
              const sn = normalizeText(s.name);
              return sn === norm || sn.includes(norm) || norm.includes(sn);
            });
            if (fuzzy) {
              supplierId = fuzzy.id;
              contactName = contactName || fuzzy.name;
            } else {
              const { data: created } = await supabase
                .from("suppliers")
                .insert({ user_id: userId, name: canonicalName })
                .select("id, name")
                .single();
              if (created) {
                supplierId = created.id;
                contactName = contactName || created.name;
                suppliersList.push(created);
              }
            }
          } else if (txType === "receita" && !clientId) {
            const fuzzy = clientsList.find((c: any) => {
              const cn = normalizeText(c.name);
              return cn === norm || cn.includes(norm) || norm.includes(cn);
            });
            if (fuzzy) {
              clientId = fuzzy.id;
              contactName = contactName || fuzzy.name;
            } else {
              const { data: created } = await supabase
                .from("clients")
                .insert({ user_id: userId, name: canonicalName })
                .select("id, name")
                .single();
              if (created) {
                clientId = created.id;
                contactName = contactName || created.name;
                clientsList.push(created);
              }
            }
          }
        }
      } catch (e) {
        console.error("Auto-resolve supplier/client error:", e);
      }

      // Dates and status
      const competenceDate = aiParsed.competence_date || aiParsed.date || today;
      let paymentDate = aiParsed.payment_date || aiParsed.date || today;
      let status: "Pago" | "Pendente" = "Pago";

      if (creditCardId) {
        const card = contextCards.find((c: any) => c.id === creditCardId);
        if (card) {
          paymentDate = getCreditCardDueDate(competenceDate, card.closing_day, card.due_day);
        }
        status = "Pendente";
      } else if (paymentDate > today) {
        status = "Pendente";
      } else if (aiParsed.status === "Pendente") {
        status = "Pendente";
      }

      // Resolve subcategory
      if (!subcategoryValue && aiParsed.subcategory_id && matchedCategory) {
        const sub = contextCategories.find((c: any) => c.id === aiParsed.subcategory_id && c.parent_id === matchedCategory.id);
        if (sub) subcategoryValue = sub.id;
      }

      // Installments
      const installmentCount = aiParsed.installments || 1;
      const installmentDetails = aiParsed.installment_details || null;

      // Helper: generate fingerprint for duplicate detection
      const generateFingerprint = (desc: string, amount: number, date: string) => {
        const raw = `${normalizeText(desc)}|${Math.abs(amount)}|${date}|${userId}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const chr = raw.charCodeAt(i);
          hash = ((hash << 5) - hash) + chr;
          hash |= 0;
        }
        return `eva_${Math.abs(hash).toString(36)}`;
      };

      // Get the original user message for reference
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
      const originalMessage = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "[imagem]";

      if (installmentCount > 1 && installmentDetails && Array.isArray(installmentDetails)) {
        const seriesId = crypto.randomUUID();
        const installmentCard = creditCardId
          ? contextCards.find((c: any) => c.id === creditCardId)
          : null;
        const pendingInstallments = installmentDetails.map((detail: any, idx: number) => {
          // If paying with credit card, ALWAYS recalculate per-installment
          // payment_date from competence + (idx) months — ignore AI's due_date,
          // which often collapses all parcelas into the same cycle.
          const installmentPaymentDate = installmentCard
            ? getInstallmentDueDate(
                competenceDate,
                installmentCard.closing_day,
                installmentCard.due_day,
                idx + 1,
              )
            : (detail.due_date || paymentDate);
          return {
            user_id: userId,
            description: `${aiParsed.description || "Lançamento via EVA"} (${idx + 1}/${installmentCount})`,
            amount: Math.abs(detail.amount || 0),
            type: txType,
            category: matchedCategory.id,
            subcategory: subcategoryValue,
            competence_date: competenceDate,
            payment_date: installmentPaymentDate,
            transaction_status: installmentCard
              ? "Pendente"
              : ((detail.due_date && detail.due_date <= today) ? "Pago" : "Pendente"),
            bank_account_id: bankAccountId,
            wallet_id: walletId,
            credit_card_id: creditCardId,
            company_id: companyId,
            payment_method: paymentMethod,
            supplier_id: supplierId,
            client_id: clientId,
            contact_name: contactName,
            notes: aiParsed.notes || null,
            barcode: detail.barcode || null,
            series_id: seriesId,
            installment_number: idx + 1,
            installments_total: installmentCount,
            source: "in_app",
            status: "pending",
            fingerprint: generateFingerprint(aiParsed.description || "", detail.amount || 0, installmentPaymentDate),
            original_message: originalMessage,
            ai_response_message: aiParsed.friendly_message || null,
          };
        });

        const { error: insertErr } = await supabase.from("ai_pending_transactions").insert(pendingInstallments);
        if (insertErr) {
          console.error("Insert pending installments error:", insertErr);
          return new Response(JSON.stringify({ reply: "❌ Erro ao criar as parcelas. Tente novamente.", action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const totalAmount = installmentDetails.reduce((s: number, d: any) => s + Math.abs(d.amount || 0), 0);
        const parcelsDisplay = installmentDetails.map((d: any, i: number) =>
          `  ${i + 1}/${installmentCount}: ${fmt(d.amount)} — vence ${formatDate(d.due_date)}`
        ).join("\n");

        return new Response(JSON.stringify({
          reply: `📋 ${installmentCount} parcelas enviadas para aprovação!\n\n📝 ${aiParsed.description}\n💰 Total: ${fmt(totalAmount)}\n📁 ${matchedCategory.name}\n\n📋 Parcelas:\n${parcelsDisplay}\n\n👉 Revise e aprove em **Análises EVA**.`,
          action: "pending_approval",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Single transaction → staging area
      const fingerprint = generateFingerprint(aiParsed.description || "", aiParsed.amount || 0, paymentDate);

      // Check for duplicates
      const { data: existingDup } = await supabase
        .from("ai_pending_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("fingerprint", fingerprint)
        .eq("status", "pending")
        .limit(1);

      if (existingDup && existingDup.length > 0) {
        return new Response(JSON.stringify({
          reply: `⚠️ Já existe um lançamento pendente similar (${aiParsed.description} — ${fmt(aiParsed.amount || 0)}). Revise em **Análises EVA** antes de criar outro.`,
          action: null,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: insertError } = await supabase.from("ai_pending_transactions").insert({
        user_id: userId,
        description: aiParsed.description || "Lançamento via EVA",
        amount: Math.abs(aiParsed.amount || 0),
        type: txType,
        category: matchedCategory.id,
        subcategory: subcategoryValue,
        competence_date: competenceDate,
        payment_date: paymentDate,
        transaction_status: status,
        bank_account_id: bankAccountId,
        wallet_id: walletId,
        credit_card_id: creditCardId,
        company_id: companyId,
        payment_method: paymentMethod,
        supplier_id: supplierId,
        client_id: clientId,
        contact_name: contactName,
        notes: aiParsed.notes || null,
        source: "in_app",
        status: "pending",
        fingerprint,
        original_message: originalMessage,
        ai_response_message: aiParsed.friendly_message || null,
      });

      if (insertError) {
        console.error("Insert pending error:", insertError);
        return new Response(JSON.stringify({ reply: "❌ Erro ao criar lançamento. Tente novamente.", action: null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const typeLabel = txType === "receita" ? "Receita" : "Despesa";
      const statusDisplay = status === "Pendente" ? " (Pendente)" : "";
      const contextLabel = aiParsed.context || "Pessoal";
      const cardName = creditCardId ? contextCards.find((c: any) => c.id === creditCardId)?.name : null;

      return new Response(JSON.stringify({
        reply: `📋 Lançamento enviado para aprovação!${statusDisplay}\n\n📝 ${aiParsed.description}\n💰 ${fmt(aiParsed.amount || 0)}\n📁 ${typeLabel} / ${matchedCategory.name}\n🏢 ${contextLabel}\n📅 ${formatDate(competenceDate)}${cardName ? `\n💳 ${cardName}` : ""}${contactName ? `\n👤 ${contactName}` : ""}\n\n👉 Revise e aprove em **Análises EVA**.`,
        action: "pending_approval",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === CONSULTA ===
    if (aiParsed.intent === "consulta") {
      if (!aiParsed.context) aiParsed.context = activeContextName;
      const baseParsed: any = aiParsed;
      const rawFollowUps = Array.isArray(baseParsed.follow_up_queries) ? baseParsed.follow_up_queries : [];
      const specs: any[] = [baseParsed];
      const seenSpecs = new Set<string>();
      const keyOf = (s: any) =>
        [s.query_type, s.category_filter, s.contact_filter, s.period_filter, s.date_from, s.date_to, s.context]
          .map((v) => String(v ?? "")).join("|").toLowerCase();
      seenSpecs.add(keyOf(baseParsed));
      for (const f of rawFollowUps) {
        if (!f || typeof f !== "object" || specs.length >= 4) continue;
        const merged = { ...baseParsed, ...f, follow_up_queries: undefined };
        const k = keyOf(merged);
        if (seenSpecs.has(k)) continue;
        seenSpecs.add(k);
        specs.push(merged);
      }
      const answerBlocks: string[] = [];

      for (const spec of specs) {
      const aiParsed: any = spec;
      const companyId = resolveContext(aiParsed.context);
      let responseMessage = "";

      const addContextFilter = (query: any) => {
        if (companyId) return query.eq("company_id", companyId);
        else if (aiParsed.context === "Pessoal") return query.is("company_id", null);
        return query;
      };

      const resolvePeriod = (): { start: string; end: string; label: string } => {
        const period = aiParsed.period_filter || "mes_atual";
        const todayDate = new Date(today + "T12:00:00");
        const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
        if (isDate(aiParsed.date_from) || isDate(aiParsed.date_to)) {
          const start = isDate(aiParsed.date_from) ? aiParsed.date_from : `${String(aiParsed.date_to).slice(0, 7)}-01`;
          let end = isDate(aiParsed.date_to) ? aiParsed.date_to : null;
          if (!end) {
            const [y, m] = start.split("-").map(Number);
            end = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
          }
          const label = aiParsed.period_label
            ? `em ${aiParsed.period_label}`
            : `de ${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}`;
          return { start, end, label };
        }
        switch (period) {

          case "mes_passado": {
            const d = new Date(todayDate); d.setMonth(d.getMonth() - 1);
            const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            return { start, end: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}`, label: "mês passado" };
          }
          case "ultimos_7_dias": { const d = new Date(todayDate); d.setDate(d.getDate() - 7); return { start: fmtD(d), end: today, label: "últimos 7 dias" }; }
          case "ultimos_30_dias": { const d = new Date(todayDate); d.setDate(d.getDate() - 30); return { start: fmtD(d), end: today, label: "últimos 30 dias" }; }
          case "ultimos_90_dias": { const d = new Date(todayDate); d.setDate(d.getDate() - 90); return { start: fmtD(d), end: today, label: "últimos 3 meses" }; }
          case "ano_atual": { return { start: `${todayDate.getFullYear()}-01-01`, end: today, label: "este ano" }; }
          case "ano_passado": {
            const y = todayDate.getFullYear() - 1;
            return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` };
          }
          default: return { start: today.substring(0, 7) + "-01", end: today, label: "este mês" };
        }
      };

      const { start: periodStart, end: periodEnd, label: periodLabel } = resolvePeriod();

      try {
        switch (aiParsed.query_type) {
          case "metas_mes": {
            const ctxCompany =
              companyId ?? (aiParsed.context === "Pessoal" ? null : undefined);
            const report = await buildBudgetMonthReport(supabase, userId, ctxCompany);
            responseMessage = formatBudgetMonthMessage(report, aiParsed.context || undefined);
            if (report.hasData) {
              const reading = await runCfoReading({
                apiKey: LOVABLE_API_KEY,
                reportText: responseMessage,
                channel: "app",
                contextLabel: aiParsed.context || null,
              });
              if (reading) responseMessage += `\n\n**🧠 Leitura da EVA (CFO)**\n\n${reading}`;
            }
            break;
          }
          case "saldo": {
            const balances: string[] = [];
            let totalBalance = 0;
            const ctxAccounts = companyId ? accounts.filter((a: any) => a.company_id === companyId) : aiParsed.context === "Pessoal" ? accounts.filter((a: any) => !a.company_id) : accounts;
            for (const acc of ctxAccounts) {
              const { data: bal } = await supabase.rpc("get_account_balance", { account_id_param: acc.id });
              const balance = bal || 0; totalBalance += balance;
              balances.push(`  • ${acc.name}: ${fmt(balance)}`);
            }
            const ctxWltsList = companyId ? wallets.filter((w: any) => w.company_id === companyId) : aiParsed.context === "Pessoal" ? wallets.filter((w: any) => !w.company_id) : wallets;
            for (const w of ctxWltsList) {
              const { data: wTxs } = await supabase.from("transactions").select("amount, type").eq("wallet_id", w.id).eq("status", "Pago").eq("user_id", userId);
              const { data: wd } = await supabase.from("wallets").select("initial_balance").eq("id", w.id).single();
              let wb = wd?.initial_balance || 0;
              (wTxs || []).forEach((t: any) => { wb += t.type === "receita" ? t.amount : -t.amount; });
              totalBalance += wb;
              balances.push(`  • ${w.name}: ${fmt(wb)}`);
            }
            responseMessage = `💰 Saldo total${aiParsed.context ? ` (${aiParsed.context})` : ""}: ${fmt(totalBalance)}\n\n${balances.join("\n")}`;
            break;
          }
          case "gastos_mes": {
            let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "despesa").eq("status", "Pago").gte("payment_date", periodStart).lte("payment_date", periodEnd);
            q = addContextFilter(q);
            const { data: expenses } = await q;
            const total = (expenses || []).reduce((s: number, t: any) => s + t.amount, 0);
            responseMessage = `📊 Total de despesas ${periodLabel}${aiParsed.context ? ` (${aiParsed.context})` : ""}: ${fmt(total)}`;
            break;
          }
          case "receitas_mes": {
            let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "receita").eq("status", "Pago").gte("payment_date", periodStart).lte("payment_date", periodEnd);
            q = addContextFilter(q);
            const { data: revenues } = await q;
            const total = (revenues || []).reduce((s: number, t: any) => s + t.amount, 0);
            responseMessage = `📊 Total de receitas ${periodLabel}${aiParsed.context ? ` (${aiParsed.context})` : ""}: ${fmt(total)}`;
            break;
          }
          case "resumo_mes": {
            let q = supabase.from("transactions").select("amount, type, category").eq("user_id", userId).eq("status", "Pago").gte("payment_date", periodStart).lte("payment_date", periodEnd);
            q = addContextFilter(q);
            const { data: txns } = await q;
            let receitas = 0, despesas = 0;
            const catTotals: Record<string, number> = {};
            (txns || []).forEach((t: any) => {
              if (t.type === "receita") receitas += t.amount;
              else { despesas += t.amount; catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; }
            });
            const top3 = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, val]) => {
              const found = categories.find((c: any) => c.id === cat);
              return `  • ${found?.name || cat}: ${fmt(val)}`;
            }).join("\n");
            responseMessage = `📊 Resumo ${periodLabel}${aiParsed.context ? ` (${aiParsed.context})` : ""}\n\n✅ Receitas: ${fmt(receitas)}\n❌ Despesas: ${fmt(despesas)}\n💰 Saldo: ${fmt(receitas - despesas)}${top3 ? "\n\n🏷️ Top categorias:\n" + top3 : ""}`;
            break;
          }
          case "pendentes": {
            let q = supabase.from("transactions").select("description, amount, type, payment_date").eq("user_id", userId).eq("status", "Pendente").order("payment_date", { ascending: true }).limit(15);
            q = addContextFilter(q);
            const { data: pending } = await q;
            if (!pending || pending.length === 0) responseMessage = "✅ Nenhuma conta pendente!";
            else {
              const list = pending.map((t: any) => `  • ${t.description}: ${fmt(t.amount)} (${t.type === "receita" ? "receber" : "pagar"} em ${formatDate(t.payment_date)})`).join("\n");
              responseMessage = `📋 Contas pendentes${aiParsed.context ? ` (${aiParsed.context})` : ""}:\n\n${list}`;
            }
            break;
          }
          case "gastos_categoria": {
            const categoryFilter = (aiParsed.category_filter || "").trim();
            const normFilter = normalizeText(categoryFilter);
            // Try category match (exact, then partial, including subcategories)
            let filterCat = categories.find((c: any) => normalizeText(c.name) === normFilter);
            if (!filterCat && normFilter) {
              filterCat = categories.find((c: any) => {
                const cn = normalizeText(c.name);
                return cn.includes(normFilter) || normFilter.includes(cn);
              });
            }
            const catIds: string[] = [];
            if (filterCat) {
              catIds.push(filterCat.id);
              categories.filter((c: any) => c.parent_id === filterCat!.id).forEach((s: any) => catIds.push(s.id));
            }
            let q = supabase.from("transactions").select("amount, description, payment_date, contact_name, status, category").eq("user_id", userId).eq("type", "despesa").gte("payment_date", periodStart).lte("payment_date", periodEnd).order("payment_date", { ascending: false }).limit(50);
            if (catIds.length > 0) {
              q = q.in("category", catIds);
            } else if (categoryFilter) {
              // Fallback: search by merchant/description (treat filter as estabelecimento)
              const safe = categoryFilter.replace(/[%_,]/g, "");
              q = q.or(`contact_name.ilike.%${safe}%,description.ilike.%${safe}%`);
            }
            q = addContextFilter(q);
            const { data: catExpenses } = await q;
            const total = (catExpenses || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
            const label = filterCat?.name || categoryFilter;
            if (!catExpenses || catExpenses.length === 0) {
              responseMessage = `📊 Nenhum gasto encontrado com "${label}" ${periodLabel}.\n\nDica: tente um termo diferente (categoria ou nome do estabelecimento).`;
            } else {
              const items = catExpenses.slice(0, 20).map((t: any) => `  • ${t.description}${t.contact_name ? ` — ${t.contact_name}` : ""}: ${fmt(Number(t.amount))} (${formatDate(t.payment_date)})`).join("\n");
              const extra = catExpenses.length > 20 ? `\n  ...e mais ${catExpenses.length - 20} lançamento(s)` : "";
              responseMessage = `📊 Gastos com "${label}" ${periodLabel}:\n\n${items}${extra}\n\n💰 Total: ${fmt(total)} (${catExpenses.length} lançamento(s))`;
            }
            break;
          }
          case "listar_lancamentos": {
            const contactFilter = aiParsed.contact_filter || "";
            const categoryFilter = aiParsed.category_filter || "";
            let q = supabase.from("transactions").select("amount, description, payment_date, contact_name, type, status, category").eq("user_id", userId).gte("payment_date", periodStart).lte("payment_date", periodEnd).order("payment_date", { ascending: false }).limit(20);
            q = addContextFilter(q);
            if (contactFilter) q = q.or(`contact_name.ilike.%${contactFilter}%,description.ilike.%${contactFilter}%`);
            if (categoryFilter) {
              const filterCat = categories.find((c: any) => c.name.toLowerCase() === categoryFilter.toLowerCase());
              if (filterCat) { const ids = [filterCat.id]; categories.filter((c: any) => c.parent_id === filterCat.id).forEach((s: any) => ids.push(s.id)); q = q.in("category", ids); }
            }
            const { data: filtered } = await q;
            if (!filtered || filtered.length === 0) responseMessage = `📋 Nenhum lançamento encontrado ${periodLabel}.`;
            else {
              let totalR = 0, totalD = 0;
              const items = filtered.map((t: any) => {
                if (t.type === "receita") totalR += t.amount; else totalD += t.amount;
                const catName = categories.find((c: any) => c.id === t.category)?.name || t.category;
                return `  ${t.type === "receita" ? "🟢" : "🔴"} ${t.description}: ${fmt(t.amount)} (${formatDate(t.payment_date)}) — ${catName}`;
              }).join("\n");
              responseMessage = `📋 Lançamentos ${periodLabel}:\n\n${items}\n\n📊 ${filtered.length} lançamento(s)${totalR > 0 ? ` | Receitas: ${fmt(totalR)}` : ""}${totalD > 0 ? ` | Despesas: ${fmt(totalD)}` : ""}`;
            }
            break;
          }
          case "listar_cartoes": {
            const ctxCards = companyId ? creditCards.filter((c: any) => c.company_id === companyId) : aiParsed.context === "Pessoal" ? creditCards.filter((c: any) => !c.company_id) : creditCards;
            if (ctxCards.length === 0) responseMessage = "💳 Nenhum cartão cadastrado.";
            else {
              const list = ctxCards.map((c: any) => `  • ${c.name}${c.last_four_digits ? ` (final ${c.last_four_digits})` : ""} — Fecha dia ${c.closing_day}, vence dia ${c.due_day}`).join("\n");
              responseMessage = `💳 Seus cartões:\n\n${list}`;
            }
            break;
          }
          case "listar_contas": {
            const ctxAcc = companyId ? accounts.filter((a: any) => a.company_id === companyId) : aiParsed.context === "Pessoal" ? accounts.filter((a: any) => !a.company_id) : accounts;
            const ctxWlt = companyId ? wallets.filter((w: any) => w.company_id === companyId) : aiParsed.context === "Pessoal" ? wallets.filter((w: any) => !w.company_id) : wallets;
            const parts: string[] = [];
            if (ctxAcc.length > 0) parts.push("🏦 Contas:\n" + ctxAcc.map((a: any) => `  • ${a.name} (${a.type})`).join("\n"));
            if (ctxWlt.length > 0) parts.push("👛 Carteiras:\n" + ctxWlt.map((w: any) => `  • ${w.name}`).join("\n"));
            responseMessage = parts.length === 0 ? "Nenhuma conta cadastrada." : `📋 Suas contas:\n\n${parts.join("\n\n")}`;
            break;
          }
          default:
            responseMessage = aiParsed.friendly_message || "Não entendi o tipo de consulta.";
        }
      } catch (e) {
        console.error("Query error:", e);
        responseMessage = "Erro ao buscar dados. Tente novamente.";
      }

      return new Response(JSON.stringify({ reply: responseMessage, action: "query" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === EDITAR LANÇAMENTO ===
    if (aiParsed.intent === "editar_lancamento") {
      let transactionId = aiParsed.transaction_id;
      const field = aiParsed.field;
      const newValue = aiParsed.new_value;

      if (!field || newValue === undefined) {
        return new Response(JSON.stringify({
          reply: aiParsed.friendly_message || "Não entendi o que quer editar. Diga qual campo e o novo valor.",
          action: null,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!transactionId && recentTransactions.length === 1) transactionId = recentTransactions[0].id;
      if (!transactionId) {
        return new Response(JSON.stringify({
          reply: "Qual lançamento deseja editar? Diga o nome ou mais detalhes.",
          action: null,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: txToEdit } = await supabase.from("transactions").select("*").eq("id", transactionId).eq("user_id", userId).single();
      if (!txToEdit) {
        return new Response(JSON.stringify({ reply: "Lançamento não encontrado.", action: null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, any> = {};
      switch (field) {
        case "amount": updateData.amount = parseFloat(String(newValue).replace(",", ".").replace(/[^\d.]/g, "")); break;
        case "description": updateData.description = String(newValue); break;
        case "payment_date": updateData.payment_date = String(newValue); break;
        case "competence_date": updateData.competence_date = String(newValue); break;
        case "status": updateData.status = String(newValue) === "Pago" ? "Pago" : "Pendente"; break;
        case "notes": updateData.notes = String(newValue); break;
        default:
          return new Response(JSON.stringify({ reply: `Campo "${field}" não editável.`, action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }

      const { error: updateErr } = await supabase.from("transactions").update(updateData).eq("id", transactionId).eq("user_id", userId);
      if (updateErr) {
        return new Response(JSON.stringify({ reply: "Erro ao atualizar. Tente novamente.", action: null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        reply: `✅ Lançamento "${txToEdit.description}" atualizado! Campo: ${field}`,
        action: "updated_transaction",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === GERENCIAR CATEGORIA ===
    if (aiParsed.intent === "gerenciar_categoria") {
      const companyId = resolveContext(aiParsed.context);
      const action = aiParsed.action;

      if (action === "criar" || action === "criar_subcategoria") {
        const categoryName = aiParsed.category_name;
        const parentId = action === "criar_subcategoria" ? aiParsed.parent_category_id : null;
        const categoryType = aiParsed.category_type || "ambos";
        if (!categoryName) {
          return new Response(JSON.stringify({ reply: "Qual o nome da categoria?", action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const parent = parentId ? categories.find((c: any) => c.id === parentId) : null;
        if (parentId && !parent) {
          return new Response(JSON.stringify({ reply: "Categoria pai não encontrada neste contexto.", action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const targetCompanyId = parent ? parent.company_id : companyId;
        const existing = categories.find((c: any) => c.name.toLowerCase() === categoryName.toLowerCase() && c.parent_id === (parentId || null) && (targetCompanyId ? c.company_id === targetCompanyId : !c.company_id));
        if (existing) {
          return new Response(JSON.stringify({ reply: `A categoria "${categoryName}" já existe!`, action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: newCat, error: catErr } = await supabase.from("categories").insert({
          user_id: userId, name: categoryName, type: parentId ? null : categoryType, parent_id: parentId, company_id: targetCompanyId,
        }).select("id, name").single();
        if (catErr) {
          return new Response(JSON.stringify({ reply: `Erro ao criar "${categoryName}".`, action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          reply: `✅ Categoria "${newCat.name}" criada!`,
          action: "created_category",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "excluir") {
        const catId = aiParsed.category_id;
        const cat = categories.find((c: any) => c.id === catId);
        if (!cat) {
          return new Response(JSON.stringify({ reply: "Categoria não encontrada.", action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase.from("categories").delete().eq("id", catId).eq("user_id", userId);
        if (error) {
          return new Response(JSON.stringify({ reply: "Erro ao excluir categoria.", action: null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          reply: `✅ Categoria "${cat.name}" excluída!`,
          action: "deleted_category",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "renomear") {
        const cat = categories.find((c: any) => c.id === aiParsed.category_id);
        if (!cat) return new Response(JSON.stringify({ reply: "Categoria não encontrada.", action: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("categories").update({ name: aiParsed.new_name }).eq("id", aiParsed.category_id).eq("user_id", userId);
        return new Response(JSON.stringify({ reply: `✅ "${cat.name}" renomeada para "${aiParsed.new_name}"!`, action: "renamed_category" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        reply: aiParsed.friendly_message || "Posso criar, renomear ou excluir categorias. O que deseja?",
        action: null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === CONVERSA ===
    // Rede de segurança: se for pergunta (ou resposta evasiva), roda a análise com dados reais.
    {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const userText = String(lastUser?.content || "");
      const fm = String(aiParsed.friendly_message || "");
      const looksEvasive = /não consigo|nao consigo|depende de|reunir os dados|não tenho acesso|nao tenho acesso|análise complexa|analise complexa/i.test(fm);
      const looksAnalytical = /\?|quanto|qual|como|por que|porque|vale a pena|posso|preciso|margem|lucro|custo|faturar|líquido|liquido/i.test(userText);
      if (userText && (looksEvasive || looksAnalytical)) {
        const contexts = resolveContexts(activeContextName, companies as any, activeContextName);
        const analysisData = await buildAnalysisData(supabase, userId, contexts, { months: 12 });
        const result = await runAnalysis({
          apiKey: LOVABLE_API_KEY,
          question: userText.slice(0, 4000),
          dataBlock: analysisData.block,
          channel: "app",
          analysisType: "diagnostico",
          history: messages.slice(-6).map((m: any) => ({ role: m.role, content: String(m.content || "") })),
        });
        if (result.ok) {
          return new Response(JSON.stringify({ reply: result.text, action: "analysis" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({
      reply: aiParsed.friendly_message || "Olá! Sou a EVA, sua assistente financeira. Posso ajudar com lançamentos, consultas e categorias. 😊",
      action: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("eva-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate webhook secret
    const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-webhook-secret");
    if (!webhookSecret || receivedSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message, image_base64, image_url } = await req.json();

    if (!phone || (!message && !image_base64 && !image_url)) {
      return new Response(
        JSON.stringify({ success: false, error: "phone and message/image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create admin Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 3. Find user by whatsapp_number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", phone)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro interno ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Número não cadastrado. Cadastre seu WhatsApp nas configurações do EVA OS.",
          message: "Número não cadastrado. Cadastre seu WhatsApp nas configurações do EVA OS.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = profile.id;

    // 4. Fetch user context (categories, accounts, wallets, companies)
    const [categoriesRes, accountsRes, walletsRes, companiesRes] = await Promise.all([
      supabase.from("categories").select("id, name, type, parent_id, company_id").eq("user_id", userId),
      supabase.from("bank_accounts").select("id, name, type, company_id").eq("user_id", userId),
      supabase.from("wallets").select("id, name, company_id").eq("user_id", userId),
      supabase.from("companies").select("id, name, cnpj").eq("user_id", userId),
    ]);

    const categories = categoriesRes.data || [];
    const accounts = accountsRes.data || [];
    const wallets = walletsRes.data || [];
    const companies = companiesRes.data || [];

    const today = new Date().toISOString().split("T")[0];

    // 5. Build context-aware category and account lists for AI prompt
    const contextNames = ["Pessoal", ...companies.map((c) => c.name)];

    const buildCategoryList = (companyId: string | null, label: string) => {
      const filtered = categories.filter((c) => c.company_id === companyId);
      const parents = filtered.filter((c) => !c.parent_id);
      if (parents.length === 0) return "";
      const lines = parents.map((p) => {
        const subs = filtered.filter((c) => c.parent_id === p.id).map((c) => c.name);
        return subs.length > 0
          ? `  ${p.name} (${p.type || "ambos"}) > ${subs.join(", ")}`
          : `  ${p.name} (${p.type || "ambos"})`;
      });
      return `[${label}]\n${lines.join("\n")}`;
    };

    const buildAccountList = (companyId: string | null, label: string) => {
      const filtered = accounts.filter((a) => a.company_id === companyId);
      if (filtered.length === 0) return "";
      return `[${label}] ${filtered.map((a) => `${a.name} (${a.type})`).join(", ")}`;
    };

    const categoryListByContext = [
      buildCategoryList(null, "Pessoal"),
      ...companies.map((c) => buildCategoryList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const accountListByContext = [
      buildAccountList(null, "Pessoal"),
      ...companies.map((c) => buildAccountList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const walletList = wallets.map((w) => w.name).join(", ");

    // 6. Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é a EVA, assistente financeira inteligente. Analise a mensagem do usuário e classifique a intenção.

REGRAS:
1. Classifique como: "lancamento", "consulta" ou "conversa"
2. Para lançamentos: extraia descrição, valor, data, tipo (receita/despesa), categoria, subcategoria e contexto
3. Para consultas: identifique o tipo (saldo, resumo_mes, gastos_mes, receitas_mes, pendentes, gastos_categoria) e contexto
4. Responda SEMPRE em português brasileiro
5. Retorne APENAS um JSON válido, sem texto adicional

CONTEXTOS DISPONÍVEIS:
${contextNames.join(", ")}
- "Pessoal" é para finanças pessoais do usuário
${companies.map((c) => `- "${c.name}" (CNPJ: ${c.cnpj}) é uma empresa do usuário`).join("\n")}
- Se o usuário não especificar o contexto, use "Pessoal" como padrão
- Se a mensagem mencionar uma empresa ou CNPJ, use o contexto correspondente

CATEGORIAS POR CONTEXTO:
${categoryListByContext || "Nenhuma categoria cadastrada"}

CONTAS BANCÁRIAS POR CONTEXTO:
${accountListByContext || "Nenhuma"}

CARTEIRAS: ${walletList || "Nenhuma"}

DATA ATUAL: ${today}

FORMATO DE RESPOSTA (JSON):
Para lançamento:
{"intent":"lancamento","description":"...","amount":0.00,"type":"receita|despesa","category":"...","subcategory":"...","date":"YYYY-MM-DD","context":"Pessoal|Nome da Empresa","friendly_message":"..."}

Para consulta:
{"intent":"consulta","query_type":"saldo|resumo_mes|gastos_mes|receitas_mes|pendentes|gastos_categoria","category_filter":"...(se aplicável)","context":"Pessoal|Nome da Empresa","friendly_message":"Vou buscar essa informação para você."}

Para conversa:
{"intent":"conversa","friendly_message":"..."}

IMPORTANTE:
- O valor (amount) deve ser sempre positivo
- A data padrão é hoje: ${today}
- Escolha a categoria mais próxima das disponíveis DENTRO DO CONTEXTO escolhido. Se nenhuma se encaixar, use "Outros"
- Para lançamentos sem tipo explícito, assuma "despesa"
- Sempre retorne o campo "context"`;

    const userContent: any[] = [];
    if (message) {
      userContent.push({ type: "text", text: message });
    }
    if (image_base64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${image_base64}` },
      });
    } else if (image_url) {
      userContent.push({
        type: "image_url",
        image_url: { url: image_url },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.length === 1 && userContent[0].type === "text" ? message : userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro ao processar mensagem com IA",
          message: "Desculpe, tive um problema ao processar sua mensagem. Tente novamente em instantes.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({
          success: true,
          intent: "conversa",
          message: "Desculpe, não consegui entender sua mensagem. Pode reformular?",
          transaction: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Resolve context to company_id ---
    const resolveContext = (contextName: string | undefined) => {
      if (!contextName || contextName === "Pessoal") return null;
      const company = companies.find(
        (c) => c.name.toLowerCase() === contextName.toLowerCase()
      );
      return company?.id || null;
    };

    // 7. Execute action based on intent
    if (parsed.intent === "lancamento") {
      const companyId = resolveContext(parsed.context);

      // Validate category exists in the chosen context
      const contextCategories = categories.filter((c) => c.company_id === companyId);
      const categoryExists = contextCategories.some(
        (c) => c.name.toLowerCase() === (parsed.category || "").toLowerCase()
      );
      const validCategory = categoryExists ? parsed.category : "Outros";

      // Pick bank account from the correct context
      const contextAccounts = accounts.filter((a) => a.company_id === companyId);
      let bankAccountId: string | null = null;
      if (contextAccounts.length === 1) {
        bankAccountId = contextAccounts[0].id;
      } else if (contextAccounts.length > 1) {
        bankAccountId = contextAccounts[0].id; // default to first
      }

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: userId,
        description: parsed.description || "Lançamento via WhatsApp",
        amount: Math.abs(parsed.amount || 0),
        type: parsed.type === "receita" ? "receita" : "despesa",
        category: validCategory,
        subcategory: parsed.subcategory || null,
        competence_date: parsed.date || today,
        payment_date: parsed.date || today,
        status: "Pago",
        bank_account_id: bankAccountId,
        company_id: companyId,
      });

      if (insertError) {
        console.error("Transaction insert error:", insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Erro ao criar lançamento",
            message: "Não consegui criar o lançamento. Tente novamente.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const typeLabel = parsed.type === "receita" ? "Receita" : "Despesa";
      const formattedAmount = fmt(parsed.amount || 0);
      const contextLabel = parsed.context || "Pessoal";

      return new Response(
        JSON.stringify({
          success: true,
          intent: "lancamento",
          message:
            parsed.friendly_message ||
            `✅ Lançamento criado!\n\n📝 ${parsed.description}\n💰 ${formattedAmount}\n📁 ${typeLabel} / ${validCategory}${parsed.subcategory ? " / " + parsed.subcategory : ""}\n🏢 ${contextLabel}\n📅 ${parsed.date || today}`,
          transaction: {
            description: parsed.description,
            amount: parsed.amount,
            type: parsed.type,
            category: validCategory,
            context: contextLabel,
            date: parsed.date || today,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (parsed.intent === "consulta") {
      const companyId = resolveContext(parsed.context);
      let responseMessage = "";

      // Helper to add company_id filter to a query
      const addContextFilter = (query: any) => {
        if (companyId) {
          return query.eq("company_id", companyId);
        } else if (parsed.context === "Pessoal") {
          return query.is("company_id", null);
        }
        // No context specified = consolidated (no filter)
        return query;
      };

      try {
        switch (parsed.query_type) {
          case "saldo": {
            const balances: string[] = [];
            let totalBalance = 0;

            const contextAccounts = companyId
              ? accounts.filter((a) => a.company_id === companyId)
              : parsed.context === "Pessoal"
                ? accounts.filter((a) => !a.company_id)
                : accounts;

            for (const acc of contextAccounts) {
              const { data: bal } = await supabase.rpc("get_account_balance", { account_id_param: acc.id });
              const balance = bal || 0;
              totalBalance += balance;
              balances.push(`  • ${acc.name}: ${fmt(balance)}`);
            }

            const contextWallets = companyId
              ? wallets.filter((w) => w.company_id === companyId)
              : parsed.context === "Pessoal"
                ? wallets.filter((w) => !w.company_id)
                : wallets;

            for (const w of contextWallets) {
              const { data: wTransactions } = await supabase
                .from("transactions")
                .select("amount, type")
                .eq("wallet_id", w.id)
                .eq("status", "Pago")
                .eq("user_id", userId);

              const { data: walletData } = await supabase
                .from("wallets")
                .select("initial_balance")
                .eq("id", w.id)
                .single();

              let walletBal = walletData?.initial_balance || 0;
              (wTransactions || []).forEach((t: any) => {
                walletBal += t.type === "receita" ? t.amount : -t.amount;
              });
              totalBalance += walletBal;
              balances.push(`  • ${w.name}: ${fmt(walletBal)}`);
            }

            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `💰 Saldo total${ctxLabel}: ${fmt(totalBalance)}\n\n${balances.join("\n")}`;
            break;
          }

          case "gastos_mes": {
            const startOfMonth = today.substring(0, 7) + "-01";
            let q = supabase
              .from("transactions")
              .select("amount")
              .eq("user_id", userId)
              .eq("type", "despesa")
              .eq("status", "Pago")
              .gte("payment_date", startOfMonth)
              .lte("payment_date", today);
            q = addContextFilter(q);
            const { data: expenses } = await q;

            const total = (expenses || []).reduce((s: number, t: any) => s + t.amount, 0);
            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `📊 Total de despesas este mês${ctxLabel}: ${fmt(total)}`;
            break;
          }

          case "receitas_mes": {
            const startOfMonth = today.substring(0, 7) + "-01";
            let q = supabase
              .from("transactions")
              .select("amount")
              .eq("user_id", userId)
              .eq("type", "receita")
              .eq("status", "Pago")
              .gte("payment_date", startOfMonth)
              .lte("payment_date", today);
            q = addContextFilter(q);
            const { data: revenues } = await q;

            const total = (revenues || []).reduce((s: number, t: any) => s + t.amount, 0);
            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `📊 Total de receitas este mês${ctxLabel}: ${fmt(total)}`;
            break;
          }

          case "resumo_mes": {
            const startOfMonth = today.substring(0, 7) + "-01";
            let q = supabase
              .from("transactions")
              .select("amount, type, category")
              .eq("user_id", userId)
              .eq("status", "Pago")
              .gte("payment_date", startOfMonth)
              .lte("payment_date", today);
            q = addContextFilter(q);
            const { data: txns } = await q;

            let receitas = 0, despesas = 0;
            const catTotals: Record<string, number> = {};

            (txns || []).forEach((t: any) => {
              if (t.type === "receita") receitas += t.amount;
              else {
                despesas += t.amount;
                catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
              }
            });

            const top3 = Object.entries(catTotals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([cat, val]) => `  • ${cat}: ${fmt(val)}`)
              .join("\n");

            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `📊 Resumo do mês${ctxLabel}\n\n✅ Receitas: ${fmt(receitas)}\n❌ Despesas: ${fmt(despesas)}\n💰 Saldo: ${fmt(receitas - despesas)}${top3 ? "\n\n🏷️ Top categorias de despesa:\n" + top3 : ""}`;
            break;
          }

          case "pendentes": {
            let q = supabase
              .from("transactions")
              .select("description, amount, type, payment_date")
              .eq("user_id", userId)
              .eq("status", "Pendente")
              .order("payment_date", { ascending: true })
              .limit(10);
            q = addContextFilter(q);
            const { data: pending } = await q;

            if (!pending || pending.length === 0) {
              responseMessage = "✅ Nenhuma conta pendente!";
            } else {
              const list = pending
                .map((t: any) => `  • ${t.description}: ${fmt(t.amount)} (${t.type === "receita" ? "receber" : "pagar"} em ${formatDate(t.payment_date)})`)
                .join("\n");
              const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
              responseMessage = `📋 Contas pendentes${ctxLabel}:\n\n${list}`;
            }
            break;
          }

          case "gastos_categoria": {
            const startOfMonth = today.substring(0, 7) + "-01";
            const categoryFilter = parsed.category_filter || "";
            let q = supabase
              .from("transactions")
              .select("amount, description")
              .eq("user_id", userId)
              .eq("type", "despesa")
              .eq("status", "Pago")
              .ilike("category", `%${categoryFilter}%`)
              .gte("payment_date", startOfMonth)
              .lte("payment_date", today);
            q = addContextFilter(q);
            const { data: catExpenses } = await q;

            const total = (catExpenses || []).reduce((s: number, t: any) => s + t.amount, 0);
            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `📊 Gastos com "${categoryFilter}" este mês${ctxLabel}: ${fmt(total)}`;
            break;
          }

          default:
            responseMessage = parsed.friendly_message || "Não entendi o tipo de consulta. Tente perguntar de outra forma.";
        }
      } catch (queryError) {
        console.error("Query error:", queryError);
        responseMessage = "Desculpe, ocorreu um erro ao buscar seus dados. Tente novamente.";
      }

      return new Response(
        JSON.stringify({
          success: true,
          intent: "consulta",
          message: responseMessage,
          transaction: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // conversa
    return new Response(
      JSON.stringify({
        success: true,
        intent: "conversa",
        message: parsed.friendly_message || "Olá! Sou a EVA, sua assistente financeira. Posso ajudar com lançamentos e consultas financeiras.",
        transaction: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
        message: "Ocorreu um erro inesperado. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

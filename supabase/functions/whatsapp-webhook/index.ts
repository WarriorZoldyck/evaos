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

    // 3. Find user by whatsapp_number with flexible matching
    // Normalize: strip everything except digits
    const digitsOnly = phone.replace(/\D/g, "");

    // Generate possible variations to search for
    const phoneCandidates = new Set<string>();
    phoneCandidates.add(phone); // original
    phoneCandidates.add(digitsOnly); // just digits
    if (digitsOnly.startsWith("55") && digitsOnly.length >= 12) {
      // With country code: try without it
      const withoutCountry = digitsOnly.slice(2);
      phoneCandidates.add(withoutCountry);
      // Try with/without the 9th digit
      if (withoutCountry.length === 11) {
        // Has 9th digit: remove it (DDD + 8 digits)
        phoneCandidates.add(withoutCountry.slice(0, 2) + withoutCountry.slice(3));
      } else if (withoutCountry.length === 10) {
        // Missing 9th digit: add it
        phoneCandidates.add(withoutCountry.slice(0, 2) + "9" + withoutCountry.slice(2));
      }
      // Also add with country code variations
      phoneCandidates.add("+" + digitsOnly);
      phoneCandidates.add("+55" + withoutCountry);
    } else {
      // Without country code
      phoneCandidates.add("55" + digitsOnly);
      phoneCandidates.add("+55" + digitsOnly);
      if (digitsOnly.length === 11) {
        phoneCandidates.add(digitsOnly.slice(0, 2) + digitsOnly.slice(3));
        phoneCandidates.add("55" + digitsOnly.slice(0, 2) + digitsOnly.slice(3));
      } else if (digitsOnly.length === 10) {
        phoneCandidates.add(digitsOnly.slice(0, 2) + "9" + digitsOnly.slice(2));
        phoneCandidates.add("55" + digitsOnly.slice(0, 2) + "9" + digitsOnly.slice(2));
      }
    }

    // Also generate formatted versions with common patterns
    const allCandidates = Array.from(phoneCandidates);

    // Fetch all profiles and match by normalized number
    console.log("=== WHATSAPP WEBHOOK DEBUG ===");
    console.log("Incoming phone:", phone);
    console.log("Digits only:", digitsOnly);
    console.log("Candidates:", JSON.stringify(allCandidates));

    const { data: allProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, whatsapp_number")
      .not("whatsapp_number", "is", null);

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro interno ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Profiles with WhatsApp:", JSON.stringify((allProfiles || []).map(p => ({ id: p.id.slice(0, 8), whatsapp: p.whatsapp_number }))));

    // Match: normalize stored numbers the same way and compare digits
    const profile = (allProfiles || []).find((p) => {
      if (!p.whatsapp_number) return false;
      const storedDigits = p.whatsapp_number.replace(/\D/g, "");
      // Direct match on any candidate
      if (allCandidates.includes(p.whatsapp_number)) return true;
      // Digits-only comparison
      if (storedDigits === digitsOnly) return true;
      // Compare last 10-11 digits (most reliable for BR numbers)
      const incomingTail = digitsOnly.slice(-11);
      const storedTail = storedDigits.slice(-11);
      if (incomingTail.length >= 10 && storedTail.length >= 10 && incomingTail === storedTail) return true;
      // Also try last 10 (without 9th digit)
      const incomingTail10 = digitsOnly.slice(-10);
      const storedTail10 = storedDigits.slice(-10);
      if (incomingTail10 === storedTail10) return true;
      return false;
    });

    if (!profile) {
      console.error("Phone NOT found. Incoming:", phone, "| Digits:", digitsOnly);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Número não cadastrado. Cadastre seu WhatsApp nas configurações do EVA OS.",
          message: "Número não cadastrado. Cadastre seu WhatsApp nas configurações do EVA OS.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Matched profile:", profile.id.slice(0, 8), "| Stored number:", profile.whatsapp_number);

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
        const subs = filtered.filter((c) => c.parent_id === p.id).map((c) => `${c.name}[${c.id}]`);
        return subs.length > 0
          ? `  ${p.name}[${p.id}] (${p.type || "ambos"}) > ${subs.join(", ")}`
          : `  ${p.name}[${p.id}] (${p.type || "ambos"})`;
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

      // --- Resolve category to UUID with fallback chain ---
      const contextCategories = categories.filter((c) =>
        companyId ? c.company_id === companyId : !c.company_id
      );
      const parsedCategoryName = (parsed.category || "").toLowerCase();

      // Try exact match (case-insensitive) on root categories
      let matchedCategory = contextCategories.find(
        (c) => !c.parent_id && c.name.toLowerCase() === parsedCategoryName
      );

      // Fallback: partial match
      if (!matchedCategory && parsedCategoryName) {
        matchedCategory = contextCategories.find(
          (c) => !c.parent_id && c.name.toLowerCase().includes(parsedCategoryName)
        );
      }

      // Fallback: "Outros" category in context
      if (!matchedCategory) {
        matchedCategory = contextCategories.find(
          (c) => !c.parent_id && c.name.toLowerCase() === "outros"
        );
      }

      // Final fallback: first root category in context
      if (!matchedCategory && contextCategories.length > 0) {
        matchedCategory = contextCategories.find((c) => !c.parent_id) || contextCategories[0];
      }

      const categoryValue = matchedCategory?.id || "Outros";
      const categoryLabel = matchedCategory?.name || parsed.category || "Outros";

      // --- Resolve subcategory to UUID ---
      let subcategoryValue: string | null = null;
      let subcategoryLabel: string | null = null;
      if (parsed.subcategory && matchedCategory) {
        const parsedSubName = parsed.subcategory.toLowerCase();
        const matchedSub = contextCategories.find(
          (c) => c.parent_id === matchedCategory!.id && c.name.toLowerCase() === parsedSubName
        );
        if (!matchedSub) {
          // Try partial match on subcategories
          const partialSub = contextCategories.find(
            (c) => c.parent_id === matchedCategory!.id && c.name.toLowerCase().includes(parsedSubName)
          );
          if (partialSub) {
            subcategoryValue = partialSub.id;
            subcategoryLabel = partialSub.name;
          }
        } else {
          subcategoryValue = matchedSub.id;
          subcategoryLabel = matchedSub.name;
        }
      }

      // --- Account resolution: bank > wallet ---
      const contextAccounts = accounts.filter((a) =>
        companyId ? a.company_id === companyId : !a.company_id
      );
      const contextWallets = wallets.filter((w) =>
        companyId ? w.company_id === companyId : !w.company_id
      );
      let bankAccountId: string | null = null;
      let walletId: string | null = null;

      if (contextAccounts.length > 0) {
        bankAccountId = contextAccounts[0].id;
      } else if (contextWallets.length > 0) {
        walletId = contextWallets[0].id;
      }

      console.log("=== LANCAMENTO RESOLUTION ===");
      console.log("Context:", parsed.context, "| companyId:", companyId);
      console.log("AI category:", parsed.category, "→ UUID:", categoryValue, "(", categoryLabel, ")");
      console.log("AI subcategory:", parsed.subcategory, "→ UUID:", subcategoryValue, "(", subcategoryLabel, ")");
      console.log("Account:", bankAccountId ? `bank:${bankAccountId}` : walletId ? `wallet:${walletId}` : "none");

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: userId,
        description: parsed.description || "Lançamento via WhatsApp",
        amount: Math.abs(parsed.amount || 0),
        type: parsed.type === "receita" ? "receita" : "despesa",
        category: categoryValue,
        subcategory: subcategoryValue,
        competence_date: parsed.date || today,
        payment_date: parsed.date || today,
        status: "Pago",
        bank_account_id: bankAccountId,
        wallet_id: walletId,
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
      const subDisplay = subcategoryLabel ? " / " + subcategoryLabel : "";

      return new Response(
        JSON.stringify({
          success: true,
          intent: "lancamento",
          message:
            parsed.friendly_message ||
            `✅ Lançamento criado!\n\n📝 ${parsed.description}\n💰 ${formattedAmount}\n📁 ${typeLabel} / ${categoryLabel}${subDisplay}\n🏢 ${contextLabel}\n📅 ${parsed.date || today}`,
          transaction: {
            description: parsed.description,
            amount: parsed.amount,
            type: parsed.type,
            category: categoryLabel,
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

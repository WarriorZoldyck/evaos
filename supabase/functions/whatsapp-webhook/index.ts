import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Confirmation/cancellation patterns
const CONFIRM_PATTERNS = /^(sim|s|pode|pode criar|cria|ok|pode sim|sim pode|confirma|confirmar|yes|y|bora|manda|vai|faz|positivo|com certeza|claro)$/i;
const CANCEL_PATTERNS = /^(não|nao|n|cancela|cancelar|cancel|no|deixa|esquece|nope|negativo|não precisa|nao precisa)$/i;

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
    const digitsOnly = phone.replace(/\D/g, "");

    const phoneCandidates = new Set<string>();
    phoneCandidates.add(phone);
    phoneCandidates.add(digitsOnly);
    if (digitsOnly.startsWith("55") && digitsOnly.length >= 12) {
      const withoutCountry = digitsOnly.slice(2);
      phoneCandidates.add(withoutCountry);
      if (withoutCountry.length === 11) {
        phoneCandidates.add(withoutCountry.slice(0, 2) + withoutCountry.slice(3));
      } else if (withoutCountry.length === 10) {
        phoneCandidates.add(withoutCountry.slice(0, 2) + "9" + withoutCountry.slice(2));
      }
      phoneCandidates.add("+" + digitsOnly);
      phoneCandidates.add("+55" + withoutCountry);
    } else {
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

    const allCandidates = Array.from(phoneCandidates);

    console.log("=== WHATSAPP WEBHOOK DEBUG ===");
    console.log("Incoming phone:", phone);
    console.log("Digits only:", digitsOnly);

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

    const profile = (allProfiles || []).find((p) => {
      if (!p.whatsapp_number) return false;
      const storedDigits = p.whatsapp_number.replace(/\D/g, "");
      if (allCandidates.includes(p.whatsapp_number)) return true;
      if (storedDigits === digitsOnly) return true;
      const incomingTail = digitsOnly.slice(-11);
      const storedTail = storedDigits.slice(-11);
      if (incomingTail.length >= 10 && storedTail.length >= 10 && incomingTail === storedTail) return true;
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

    // ============================================================
    // CHECK FOR PENDING ACTIONS BEFORE ANYTHING ELSE
    // ============================================================
    if (message) {
      const trimmedMsg = message.trim();

      // Clean up expired pending actions first
      await supabase
        .from("whatsapp_pending_actions")
        .delete()
        .eq("user_id", userId)
        .lt("expires_at", new Date().toISOString());

      // Check for active pending action
      const { data: pendingActions } = await supabase
        .from("whatsapp_pending_actions")
        .select("*")
        .eq("user_id", userId)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      const pendingAction = pendingActions?.[0];

      if (pendingAction) {
        // User is responding to a pending action
        if (CONFIRM_PATTERNS.test(trimmedMsg)) {
          console.log("=== PENDING ACTION: CONFIRMED ===");
          console.log("Creating category:", pendingAction.suggested_category_name);

          // Create the category
          const { data: newCategory, error: catError } = await supabase
            .from("categories")
            .insert({
              user_id: userId,
              name: pendingAction.suggested_category_name,
              type: pendingAction.category_type,
              company_id: pendingAction.context_company_id,
            })
            .select("id, name")
            .single();

          if (catError) {
            console.error("Failed to create category:", catError);
            // Clean up pending action
            await supabase.from("whatsapp_pending_actions").delete().eq("id", pendingAction.id);
            return new Response(
              JSON.stringify({
                success: false,
                intent: "lancamento",
                message: `❌ Não consegui criar a categoria "${pendingAction.suggested_category_name}". Tente novamente.`,
                transaction: null,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          console.log("Category created:", newCategory.id, newCategory.name);

          // Now create the transaction using the stored payload
          const payload = pendingAction.payload as any;
          const txType = payload.type === "receita" ? "receita" : "despesa";

          // Resolve account from payload
          const [accountsRes, walletsRes] = await Promise.all([
            supabase.from("bank_accounts").select("id, name, company_id").eq("user_id", userId),
            supabase.from("wallets").select("id, name, company_id").eq("user_id", userId),
          ]);
          const accounts = accountsRes.data || [];
          const walletsList = walletsRes.data || [];
          const companyId = pendingAction.context_company_id;

          const contextAccounts = accounts.filter((a) =>
            companyId ? a.company_id === companyId : !a.company_id
          );
          const contextWallets = walletsList.filter((w) =>
            companyId ? w.company_id === companyId : !w.company_id
          );

          let bankAccountId: string | null = null;
          let walletId: string | null = null;

          if (payload.account_id) {
            const accMatch = contextAccounts.find((a) => a.id === payload.account_id);
            if (accMatch) bankAccountId = accMatch.id;
            else {
              const walMatch = contextWallets.find((w) => w.id === payload.account_id);
              if (walMatch) walletId = walMatch.id;
            }
          }
          if (!bankAccountId && !walletId) {
            if (contextAccounts.length > 0) bankAccountId = contextAccounts[0].id;
            else if (contextWallets.length > 0) walletId = contextWallets[0].id;
          }

          const today = new Date().toISOString().split("T")[0];

          const { error: insertError } = await supabase.from("transactions").insert({
            user_id: userId,
            description: payload.description || "Lançamento via WhatsApp",
            amount: Math.abs(payload.amount || 0),
            type: txType,
            category: newCategory.id,
            subcategory: null,
            competence_date: payload.date || today,
            payment_date: payload.date || today,
            status: "Pago",
            bank_account_id: bankAccountId,
            wallet_id: walletId,
            company_id: companyId,
          });

          // Clean up pending action
          await supabase.from("whatsapp_pending_actions").delete().eq("id", pendingAction.id);

          if (insertError) {
            console.error("Transaction insert error after category creation:", insertError);
            return new Response(
              JSON.stringify({
                success: false,
                intent: "lancamento",
                message: `✅ Categoria "${newCategory.name}" criada, mas houve um erro ao criar o lançamento. Tente enviar novamente.`,
                transaction: null,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const typeLabel = txType === "receita" ? "Receita" : "Despesa";
          const contextLabel = payload.context || "Pessoal";
          return new Response(
            JSON.stringify({
              success: true,
              intent: "lancamento",
              message: `✅ Categoria "${newCategory.name}" criada e lançamento registrado!\n\n📝 ${payload.description}\n💰 ${fmt(payload.amount || 0)}\n📁 ${typeLabel} / ${newCategory.name}\n🏢 ${contextLabel}\n📅 ${payload.date || today}`,
              transaction: {
                description: payload.description,
                amount: payload.amount,
                type: txType,
                category: newCategory.name,
                context: contextLabel,
                date: payload.date || today,
              },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (CANCEL_PATTERNS.test(trimmedMsg)) {
          console.log("=== PENDING ACTION: CANCELLED ===");
          await supabase.from("whatsapp_pending_actions").delete().eq("id", pendingAction.id);
          return new Response(
            JSON.stringify({
              success: true,
              intent: "conversa",
              message: "Ok, cancelei o lançamento. Se precisar de algo, é só falar! 😊",
              transaction: null,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Message doesn't match confirm/cancel — clear pending and process normally
        console.log("=== PENDING ACTION: IGNORED (new message) ===");
        await supabase.from("whatsapp_pending_actions").delete().eq("id", pendingAction.id);
      }
    }

    // 4. Fetch user context (categories, accounts, wallets, companies, credit cards, contacts)
    const [categoriesRes, accountsRes, walletsRes, companiesRes, creditCardsRes, suppliersRes, clientsRes] = await Promise.all([
      supabase.from("categories").select("id, name, type, parent_id, company_id").eq("user_id", userId),
      supabase.from("bank_accounts").select("id, name, type, company_id").eq("user_id", userId),
      supabase.from("wallets").select("id, name, company_id").eq("user_id", userId),
      supabase.from("companies").select("id, name, cnpj").eq("user_id", userId),
      supabase.from("credit_cards").select("id, name, last_four_digits, closing_day, due_day, company_id, bank_account_id").eq("user_id", userId),
      supabase.from("suppliers").select("id, name").eq("user_id", userId),
      supabase.from("clients").select("id, name").eq("user_id", userId),
    ]);

    const categories = categoriesRes.data || [];
    const accounts = accountsRes.data || [];
    const wallets = walletsRes.data || [];
    const companies = companiesRes.data || [];
    const creditCards = creditCardsRes.data || [];
    const suppliersList = suppliersRes.data || [];
    const clientsList = clientsRes.data || [];

    const today = new Date().toISOString().split("T")[0];

    // 5. Build context-aware category and account lists for AI prompt
    const contextNames = ["Pessoal", ...companies.map((c) => c.name)];

    const buildCategoryList = (companyId: string | null, label: string) => {
      const filtered = categories.filter((c) => c.company_id === companyId);
      const parents = filtered.filter((c) => !c.parent_id);
      if (parents.length === 0) return "";
      const lines = parents.map((p) => {
        const subs = filtered
          .filter((c) => c.parent_id === p.id)
          .map((c) => {
            // 3rd level
            const level3 = filtered.filter((l3) => l3.parent_id === c.id).map((l3) => `${l3.name}[${l3.id}]`);
            return level3.length > 0
              ? `${c.name}[${c.id}] > ${level3.join(", ")}`
              : `${c.name}[${c.id}]`;
          });
        const typeTag = p.type === "receita" ? "RECEITA" : p.type === "despesa" ? "DESPESA" : "AMBOS";
        return subs.length > 0
          ? `  ${p.name}[${p.id}] (${typeTag}) > ${subs.join("; ")}`
          : `  ${p.name}[${p.id}] (${typeTag})`;
      });
      return `[${label}]\n${lines.join("\n")}`;
    };

    const buildAccountList = (companyId: string | null, label: string) => {
      const ctxAccounts = accounts.filter((a) => a.company_id === companyId);
      const ctxWallets = wallets.filter((w) => w.company_id === companyId);
      const ctxCards = creditCards.filter((c) => c.company_id === companyId);
      const parts: string[] = [];
      if (ctxAccounts.length > 0) {
        parts.push("Contas: " + ctxAccounts.map((a) => `${a.name}[${a.id}]`).join(", "));
      }
      if (ctxWallets.length > 0) {
        parts.push("Carteiras: " + ctxWallets.map((w) => `${w.name}[${w.id}]`).join(", "));
      }
      if (ctxCards.length > 0) {
        parts.push("Cartões de Crédito: " + ctxCards.map((c) => `${c.name}${c.last_four_digits ? ` Final ${c.last_four_digits}` : ""}[${c.id}]`).join(", "));
      }
      if (parts.length === 0) return "";
      return `[${label}] ${parts.join(" | ")}`;
    };

    const buildContactList = () => {
      const parts: string[] = [];
      if (suppliersList.length > 0) {
        parts.push("FORNECEDORES: " + suppliersList.map((s) => `${s.name}[${s.id}]`).join(", "));
      }
      if (clientsList.length > 0) {
        parts.push("CLIENTES: " + clientsList.map((c) => `${c.name}[${c.id}]`).join(", "));
      }
      return parts.join("\n");
    };

    const categoryListByContext = [
      buildCategoryList(null, "Pessoal"),
      ...companies.map((c) => buildCategoryList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const accountListByContext = [
      buildAccountList(null, "Pessoal"),
      ...companies.map((c) => buildAccountList(c.id, c.name)),
    ].filter(Boolean).join("\n");

    const contactList = buildContactList();

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
2. Para lançamentos: extraia TODOS os campos possíveis da mensagem
3. Para consultas: identifique o tipo e contexto
4. Responda SEMPRE em português brasileiro
5. Retorne APENAS um JSON válido, sem texto adicional

CONTEXTOS DISPONÍVEIS (use EXATAMENTE um destes valores no campo "context"):
${contextNames.map((n) => `  - "${n}"`).join("\n")}
- "Pessoal" é para finanças pessoais do usuário
${companies.map((c) => `- "${c.name}" (CNPJ: ${c.cnpj}) é uma empresa do usuário`).join("\n")}
- Se o usuário NÃO especificar o contexto, use "Pessoal"
- Se a mensagem mencionar uma empresa ou CNPJ, use o contexto correspondente
- NÃO invente nomes de contexto. Use SOMENTE os listados acima.

CATEGORIAS POR CONTEXTO (formato: Nome[UUID] (TIPO)):
${categoryListByContext || "Nenhuma categoria cadastrada"}

REGRA DE TIPO: 
- Se type="receita", escolha APENAS categorias marcadas como RECEITA ou AMBOS
- Se type="despesa", escolha APENAS categorias marcadas como DESPESA ou AMBOS
- NUNCA escolha uma categoria de RECEITA para uma despesa, ou vice-versa

REGRA CRÍTICA DE CATEGORIA:
- Se NENHUMA categoria da lista acima se encaixar na descrição do lançamento, retorne category_id como null e preencha o campo "suggested_category_name" com o nome que faria sentido.
- NÃO invente UUIDs que não existam na lista.
- NÃO escolha uma categoria aleatória só para preencher. Se não faz sentido, retorne null.

CONTAS, CARTEIRAS E CARTÕES DE CRÉDITO POR CONTEXTO (formato: Nome[UUID]):
${accountListByContext || "Nenhuma conta cadastrada"}

${contactList ? `CONTATOS DO USUÁRIO:\n${contactList}` : ""}

MÉTODOS DE PAGAMENTO VÁLIDOS:
- "pix" - Transferência Pix
- "dinheiro" - Dinheiro em espécie
- "cartao_debito" - Cartão de débito
- "cartao_credito" - Cartão de crédito (DEVE vir com credit_card_id)
- "boleto" - Boleto bancário
- "transferencia" - Transferência bancária (TED/DOC)
- Se não mencionado, retorne null

DATA ATUAL: ${today}

FORMATO DE RESPOSTA (JSON):
Para lançamento:
{"intent":"lancamento","description":"...","amount":0.00,"type":"receita|despesa","category_id":"UUID-da-lista-ou-null","subcategory_id":"UUID-ou-null","suggested_category_name":"nome sugerido se category_id for null, senão null","context":"Pessoal|Nome da Empresa","account_id":"UUID-da-conta-ou-carteira-ou-null","credit_card_id":"UUID-do-cartao-ou-null","payment_method":"pix|dinheiro|cartao_debito|cartao_credito|boleto|transferencia|null","contact_name":"nome do contato mencionado|null","supplier_id":"UUID-do-fornecedor-ou-null","client_id":"UUID-do-cliente-ou-null","competence_date":"YYYY-MM-DD","payment_date":"YYYY-MM-DD-ou-null","status":"Pago|Pendente","notes":"observações extras|null","date":"YYYY-MM-DD","friendly_message":"..."}

REGRAS DOS NOVOS CAMPOS:
- Se o usuário mencionar "cartão", "crédito", "no cartão X", use payment_method="cartao_credito" e retorne credit_card_id com o UUID do cartão da lista. NÃO preencha account_id nesse caso.
- Se o usuário mencionar "pix", "transferência", "boleto", "dinheiro", "débito", preencha payment_method adequadamente.
- competence_date = quando a despesa/receita ACONTECEU (data do evento). Padrão: hoje.
- payment_date = quando o dinheiro SAI/ENTRA da conta. Para cartão de crédito, retorne null (o sistema calculará pela data de vencimento da fatura). Para outros métodos, é igual a competence_date por padrão.
- status: Se a data de pagamento é FUTURA ou se é cartão de crédito, use "Pendente". Caso contrário, "Pago".
- Se o usuário mencionar "paguei para [nome]" ou "comprei de [nome]", tente encontrar o UUID na lista de FORNECEDORES (para despesa) ou CLIENTES (para receita). Se não encontrar UUID, preencha contact_name com o nome mencionado.
- notes: qualquer observação extra que o usuário mencionar (ex: "referente ao mês de janeiro").

IMPORTANTE SOBRE category_id e subcategory_id:
- Retorne o UUID que está entre colchetes [UUID] na lista de categorias acima
- NÃO retorne o nome da categoria, retorne o UUID
- Se nenhuma categoria se encaixar, retorne null em category_id e preencha suggested_category_name
- subcategory_id é o UUID de uma subcategoria (filho da categoria pai)

IMPORTANTE SOBRE account_id e credit_card_id:
- Retorne o UUID que está entre colchetes [UUID] na lista de contas/carteiras/cartões
- Se payment_method é "cartao_credito", preencha credit_card_id e NÃO preencha account_id
- Se não souber qual conta, retorne null (será usada a primeira disponível no contexto)

Para consulta:
{"intent":"consulta","query_type":"saldo|resumo_mes|gastos_mes|receitas_mes|pendentes|gastos_categoria","category_filter":"...(se aplicável)","context":"Pessoal|Nome da Empresa","friendly_message":"Vou buscar essa informação para você."}

Para conversa:
{"intent":"conversa","friendly_message":"..."}

IMPORTANTE:
- O valor (amount) deve ser sempre positivo
- A data padrão é hoje: ${today}
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

    // --- Resolve context to company_id (strict) ---
    const resolveContext = (contextName: string | undefined): string | null => {
      if (!contextName || contextName === "Pessoal") return null;
      const company = companies.find(
        (c) => c.name.toLowerCase() === contextName.toLowerCase()
      );
      return company?.id || null;
    };

    // --- Validate context exists ---
    const validateContext = (contextName: string | undefined): boolean => {
      if (!contextName || contextName === "Pessoal") return true;
      return companies.some((c) => c.name.toLowerCase() === contextName.toLowerCase());
    };

    // 7. Execute action based on intent
    if (parsed.intent === "lancamento") {
      // Validate context strictly
      if (!validateContext(parsed.context)) {
        console.warn("AI returned invalid context:", parsed.context, "| Available:", contextNames);
        parsed.context = "Pessoal";
      }

      const companyId = resolveContext(parsed.context);

      // --- Resolve category_id with UUID-first approach ---
      const contextCategories = categories.filter((c) =>
        companyId ? c.company_id === companyId : !c.company_id
      );
      const txType = parsed.type === "receita" ? "receita" : "despesa";

      // Helper: check if category type matches transaction type
      const typeMatches = (cat: any) => {
        return !cat.type || cat.type === "ambos" || cat.type === txType;
      };

      let matchedCategory: any = null;
      let subcategoryValue: string | null = null;
      let subcategoryLabel: string | null = null;

      // Step 1: Try direct UUID match from AI response
      if (parsed.category_id) {
        matchedCategory = contextCategories.find(
          (c) => c.id === parsed.category_id && !c.parent_id
        );
        // If AI returned a subcategory UUID as category_id, find its parent
        if (!matchedCategory) {
          const asSub = contextCategories.find((c) => c.id === parsed.category_id && c.parent_id);
          if (asSub) {
            matchedCategory = contextCategories.find((c) => c.id === asSub.parent_id);
            subcategoryValue = asSub.id;
            subcategoryLabel = asSub.name;
          }
        }
      }

      // Step 2: Fallback - AI might have returned a name in category_id field
      if (!matchedCategory && parsed.category_id) {
        const nameGuess = parsed.category_id.toLowerCase();
        matchedCategory = contextCategories.find(
          (c) => !c.parent_id && c.name.toLowerCase() === nameGuess && typeMatches(c)
        );
        if (!matchedCategory) {
          matchedCategory = contextCategories.find(
            (c) => !c.parent_id && c.name.toLowerCase().includes(nameGuess) && typeMatches(c)
          );
        }
      }

      // Step 3: Legacy fallback - AI returned "category" as name (old format)
      if (!matchedCategory && parsed.category) {
        const parsedCategoryName = parsed.category.toLowerCase();
        matchedCategory = contextCategories.find(
          (c) => !c.parent_id && c.name.toLowerCase() === parsedCategoryName && typeMatches(c)
        );
        if (!matchedCategory) {
          matchedCategory = contextCategories.find(
            (c) => !c.parent_id && c.name.toLowerCase().includes(parsedCategoryName) && typeMatches(c)
          );
        }
      }

      // ============================================================
      // NO MORE FALLBACKS — if no match, ask user to confirm creation
      // ============================================================
      if (!matchedCategory) {
        const suggestedName = parsed.suggested_category_name || parsed.description || "Nova Categoria";
        const contextLabel = parsed.context || "Pessoal";

        console.log("=== NO CATEGORY MATCH — ASKING FOR CONFIRMATION ===");
        console.log("Suggested name:", suggestedName, "| Context:", contextLabel, "| Type:", txType);

        // Save pending action
        const { error: pendingError } = await supabase
          .from("whatsapp_pending_actions")
          .insert({
            user_id: userId,
            action_type: "create_category",
            payload: {
              description: parsed.description,
              amount: parsed.amount,
              type: txType,
              context: parsed.context,
              account_id: parsed.account_id,
              date: parsed.date || today,
            },
            suggested_category_name: suggestedName,
            category_type: txType === "receita" ? "receita" : "despesa",
            context_company_id: companyId,
          });

        if (pendingError) {
          console.error("Failed to save pending action:", pendingError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            intent: "lancamento",
            message: `🤔 Não encontrei a categoria "${suggestedName}" no contexto "${contextLabel}".\n\nQuer que eu crie essa categoria e registre o lançamento?\n\nResponda *sim* para confirmar ou *não* para cancelar.`,
            transaction: null,
            pending_confirmation: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Warn if type didn't match
      if (matchedCategory && !typeMatches(matchedCategory)) {
        console.warn("Category type mismatch:", matchedCategory.name, "(", matchedCategory.type, ") vs transaction type:", txType);
      }

      const categoryValue = matchedCategory?.id || null;
      const categoryLabel = matchedCategory?.name || "Sem categoria";

      // --- Resolve subcategory_id ---
      if (!subcategoryValue && parsed.subcategory_id && matchedCategory) {
        const subMatch = contextCategories.find(
          (c) => c.id === parsed.subcategory_id && c.parent_id === matchedCategory!.id
        );
        if (subMatch) {
          subcategoryValue = subMatch.id;
          subcategoryLabel = subMatch.name;
        }
      }
      // Legacy: AI returned subcategory as name
      if (!subcategoryValue && parsed.subcategory && matchedCategory) {
        const parsedSubName = parsed.subcategory.toLowerCase();
        const subMatch = contextCategories.find(
          (c) => c.parent_id === matchedCategory!.id && c.name.toLowerCase() === parsedSubName
        ) || contextCategories.find(
          (c) => c.parent_id === matchedCategory!.id && c.name.toLowerCase().includes(parsedSubName)
        );
        if (subMatch) {
          subcategoryValue = subMatch.id;
          subcategoryLabel = subMatch.name;
        }
      }

      // --- Account / Credit Card resolution ---
      const contextAccounts = accounts.filter((a) =>
        companyId ? a.company_id === companyId : !a.company_id
      );
      const contextWallets = wallets.filter((w) =>
        companyId ? w.company_id === companyId : !w.company_id
      );
      const contextCards = creditCards.filter((c) =>
        companyId ? c.company_id === companyId : !c.company_id
      );

      let bankAccountId: string | null = null;
      let walletId: string | null = null;
      let creditCardId: string | null = null;
      let paymentMethod: string | null = parsed.payment_method || null;

      // Credit card resolution
      if (parsed.credit_card_id) {
        const cardMatch = contextCards.find((c) => c.id === parsed.credit_card_id);
        if (cardMatch) {
          creditCardId = cardMatch.id;
          bankAccountId = cardMatch.bank_account_id;
          paymentMethod = "cartao_credito";
        }
      }
      // If AI said cartao_credito but no card ID, try first available card
      if (!creditCardId && paymentMethod === "cartao_credito" && contextCards.length > 0) {
        creditCardId = contextCards[0].id;
        bankAccountId = contextCards[0].bank_account_id;
      }

      // Regular account resolution (only if not credit card)
      if (!creditCardId) {
        if (parsed.account_id) {
          const accMatch = contextAccounts.find((a) => a.id === parsed.account_id);
          if (accMatch) {
            bankAccountId = accMatch.id;
          } else {
            const walMatch = contextWallets.find((w) => w.id === parsed.account_id);
            if (walMatch) {
              walletId = walMatch.id;
            }
          }
        }
        // Fallback: first available bank account, then wallet
        if (!bankAccountId && !walletId) {
          if (contextAccounts.length > 0) {
            bankAccountId = contextAccounts[0].id;
          } else if (contextWallets.length > 0) {
            walletId = contextWallets[0].id;
          }
        }
      }

      // --- BLOCK if no account/wallet/card ---
      const contextLabel = parsed.context || "Pessoal";

      if (!bankAccountId && !walletId && !creditCardId) {
        console.error("BLOCKED: No account/wallet/card for context:", contextLabel);
        return new Response(
          JSON.stringify({
            success: false,
            intent: "lancamento",
            message: `❌ Não consegui criar o lançamento porque você não tem nenhuma conta bancária, carteira ou cartão cadastrado no contexto "${contextLabel}". Cadastre uma conta antes de lançar.`,
            transaction: null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!categoryValue) {
        console.error("BLOCKED: No category resolved for context:", contextLabel, "| type:", txType);
        return new Response(
          JSON.stringify({
            success: false,
            intent: "lancamento",
            message: `❌ Não consegui criar o lançamento porque não há categorias de ${txType} cadastradas no contexto "${contextLabel}". Cadastre categorias antes de lançar.`,
            transaction: null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Credit card cycle date calculation ---
      const competenceDate = parsed.competence_date || parsed.date || today;
      let paymentDate = parsed.payment_date || parsed.date || today;

      if (creditCardId) {
        const card = contextCards.find((c) => c.id === creditCardId);
        if (card) {
          const compDate = new Date(competenceDate + "T12:00:00");
          const compDay = compDate.getDate();
          const compMonth = compDate.getMonth();
          const compYear = compDate.getFullYear();

          let billMonth: number;
          let billYear: number;

          if (compDay >= card.closing_day) {
            // Goes to next month's bill
            billMonth = compMonth + 1;
            billYear = compYear;
          } else {
            // Goes to current month's bill
            billMonth = compMonth;
            billYear = compYear;
          }

          // Calculate due date
          let dueMonth = billMonth;
          let dueYear = billYear;
          if (card.due_day < card.closing_day) {
            // Due is in the month after closing
            dueMonth = billMonth + 1;
            dueYear = billYear;
          }
          if (dueMonth > 11) {
            dueMonth = dueMonth - 12;
            dueYear++;
          }

          const dueDate = new Date(dueYear, dueMonth, card.due_day);
          paymentDate = dueDate.toISOString().split("T")[0];
        }
      }

      // --- Contact / Supplier / Client resolution ---
      let supplierId: string | null = null;
      let clientId: string | null = null;
      let contactName: string | null = parsed.contact_name || null;

      if (parsed.supplier_id) {
        const supMatch = suppliersList.find((s) => s.id === parsed.supplier_id);
        if (supMatch) {
          supplierId = supMatch.id;
          contactName = contactName || supMatch.name;
        }
      }
      if (parsed.client_id) {
        const cliMatch = clientsList.find((c) => c.id === parsed.client_id);
        if (cliMatch) {
          clientId = cliMatch.id;
          contactName = contactName || cliMatch.name;
        }
      }

      // --- Smart status detection ---
      let status: "Pago" | "Pendente" = "Pago";
      if (creditCardId) {
        status = "Pendente"; // Credit card → always pending (paid on bill)
      } else if (paymentDate > today) {
        status = "Pendente"; // Future payment → pending
      } else if (parsed.status === "Pendente") {
        status = "Pendente"; // AI explicitly said pending
      }

      console.log("=== LANCAMENTO RESOLUTION ===");
      console.log("Context:", parsed.context, "| companyId:", companyId);
      console.log("AI category_id:", parsed.category_id, "| AI category (legacy):", parsed.category);
      console.log("Resolved → UUID:", categoryValue, "(", categoryLabel, ")");
      console.log("AI subcategory_id:", parsed.subcategory_id, "→ UUID:", subcategoryValue, "(", subcategoryLabel, ")");
      console.log("Account:", bankAccountId ? `bank:${bankAccountId}` : walletId ? `wallet:${walletId}` : "none");
      console.log("Credit card:", creditCardId, "| Payment method:", paymentMethod);
      console.log("Competence:", competenceDate, "| Payment:", paymentDate, "| Status:", status);
      console.log("Supplier:", supplierId, "| Client:", clientId, "| Contact:", contactName);

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: userId,
        description: parsed.description || "Lançamento via WhatsApp",
        amount: Math.abs(parsed.amount || 0),
        type: txType,
        category: categoryValue,
        subcategory: subcategoryValue,
        competence_date: competenceDate,
        payment_date: paymentDate,
        status: status,
        bank_account_id: bankAccountId,
        wallet_id: walletId,
        credit_card_id: creditCardId,
        company_id: companyId,
        payment_method: paymentMethod,
        supplier_id: supplierId,
        client_id: clientId,
        contact_name: contactName,
        notes: parsed.notes || null,
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

      const typeLabel = txType === "receita" ? "Receita" : "Despesa";
      const formattedAmount = fmt(parsed.amount || 0);
      const subDisplay = subcategoryLabel ? " / " + subcategoryLabel : "";
      const payMethodDisplay = paymentMethod ? `\n💳 ${paymentMethod.replace("_", " ")}` : "";
      const contactDisplay = contactName ? `\n👤 ${contactName}` : "";
      const statusDisplay = status === "Pendente" ? " (Pendente)" : "";
      const cardName = creditCardId ? contextCards.find(c => c.id === creditCardId)?.name : null;
      const accountDisplay = cardName ? `\n🏦 ${cardName}` : "";

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
            type: txType,
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

      const addContextFilter = (query: any) => {
        if (companyId) {
          return query.eq("company_id", companyId);
        } else if (parsed.context === "Pessoal") {
          return query.is("company_id", null);
        }
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

            // Resolve category UUIDs to names for display
            const resolveCatName = (catIdOrName: string): string => {
              const found = categories.find((c) => c.id === catIdOrName);
              return found ? found.name : catIdOrName;
            };

            const top3 = Object.entries(catTotals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([cat, val]) => `  • ${resolveCatName(cat)}: ${fmt(val)}`)
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
            // Try to resolve filter as category name to UUID for more accurate filtering
            const filterCat = categories.find(
              (c) => c.name.toLowerCase() === categoryFilter.toLowerCase()
            );
            let q = supabase
              .from("transactions")
              .select("amount, description")
              .eq("user_id", userId)
              .eq("type", "despesa")
              .eq("status", "Pago")
              .gte("payment_date", startOfMonth)
              .lte("payment_date", today);
            
            if (filterCat) {
              q = q.eq("category", filterCat.id);
            } else {
              q = q.ilike("category", `%${categoryFilter}%`);
            }
            q = addContextFilter(q);
            const { data: catExpenses } = await q;

            const total = (catExpenses || []).reduce((s: number, t: any) => s + t.amount, 0);
            const ctxLabel = parsed.context ? ` (${parsed.context})` : "";
            responseMessage = `📊 Gastos com "${filterCat?.name || categoryFilter}" este mês${ctxLabel}: ${fmt(total)}`;
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

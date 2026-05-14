import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPluggyApiKey, pluggyGet } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const {
      item_id,
      account_id, // Pluggy account id selected by user
      mode,
      bank_account_id,
      account_name,
      company_id,
    } = body as {
      item_id?: string;
      account_id?: string;
      mode?: "new_account" | "link_existing";
      bank_account_id?: string;
      account_name?: string;
      company_id?: string | null;
    };

    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id obrigatório" }), { status: 400, headers: corsHeaders });
    }
    if (!mode || !["new_account", "link_existing"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Modo inválido" }), { status: 400, headers: corsHeaders });
    }

    const apiKey = await getPluggyApiKey();

    // Fetch item (for institution name) + accounts
    const item = await pluggyGet(`/items/${item_id}`, apiKey);
    const accountsRes = await pluggyGet(`/accounts?itemId=${item_id}`, apiKey);
    const accounts = (accountsRes?.results || []) as any[];
    if (accounts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma conta encontrada na Pluggy para este item" }), { status: 400, headers: corsHeaders });
    }

    // pick: account_id passed by client, otherwise first BANK type account
    const chosen = account_id
      ? accounts.find((a) => a.id === account_id)
      : accounts.find((a) => a.type === "BANK") || accounts[0];
    if (!chosen) {
      return new Response(JSON.stringify({ error: "Conta Pluggy inválida" }), { status: 400, headers: corsHeaders });
    }

    const initialBalance = Number(chosen.balance ?? 0);
    const institutionName: string = item?.connector?.name || "Itaú";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let finalBankAccountId = bank_account_id || null;
    let finalCompanyId = company_id ?? null;

    if (mode === "new_account") {
      const name = (account_name || institutionName).slice(0, 80);
      const { data: acc, error: accErr } = await admin
        .from("bank_accounts")
        .insert({
          user_id: userId,
          name,
          type: "Conta Corrente",
          initial_balance: initialBalance,
          company_id: finalCompanyId,
        })
        .select()
        .single();
      if (accErr) {
        return new Response(JSON.stringify({ error: "Falha ao criar conta: " + accErr.message }), { status: 500, headers: corsHeaders });
      }
      finalBankAccountId = acc.id;
      finalCompanyId = acc.company_id;
    } else {
      if (!finalBankAccountId) {
        return new Response(JSON.stringify({ error: "Conta bancária não informada" }), { status: 400, headers: corsHeaders });
      }
      const { data: acc, error: accErr } = await admin
        .from("bank_accounts")
        .select("id, company_id, user_id")
        .eq("id", finalBankAccountId)
        .maybeSingle();
      if (accErr || !acc || acc.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Conta bancária inválida" }), { status: 400, headers: corsHeaders });
      }
      finalCompanyId = acc.company_id;
    }

    const { data: integration, error: intErr } = await admin
      .from("pluggy_integrations")
      .upsert(
        {
          user_id: userId,
          company_id: finalCompanyId,
          bank_account_id: finalBankAccountId,
          pluggy_item_id: item_id,
          pluggy_account_id: chosen.id,
          institution_name: institutionName,
          connector_id: item?.connector?.id ?? null,
          initial_balance_synced: initialBalance,
          item_status: item?.status || null,
          sync_status: "idle",
        },
        { onConflict: "user_id,pluggy_account_id" },
      )
      .select()
      .single();

    if (intErr) {
      return new Response(JSON.stringify({ error: intErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ integration, balance: initialBalance, accounts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("pluggy-connect-account error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptApiKey } from "../_shared/asaas-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

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
    const { api_key, mode, bank_account_id, account_name, company_id } = body as {
      api_key?: string;
      mode?: "new_account" | "link_existing";
      bank_account_id?: string;
      account_name?: string;
      company_id?: string | null;
    };

    if (!api_key || typeof api_key !== "string" || api_key.length < 20) {
      return new Response(JSON.stringify({ error: "API Key inválida" }), { status: 400, headers: corsHeaders });
    }
    if (!mode || !["new_account", "link_existing"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Modo inválido" }), { status: 400, headers: corsHeaders });
    }

    // Validate API key against Asaas
    const balRes = await fetch(`${ASAAS_BASE}/finance/balance`, {
      headers: { access_token: api_key, "User-Agent": "EVA OS" },
    });
    if (!balRes.ok) {
      return new Response(
        JSON.stringify({ error: "Chave Asaas inválida ou sem permissão (HTTP " + balRes.status + ")" }),
        { status: 400, headers: corsHeaders },
      );
    }
    const balance = await balRes.json();
    const initialBalance = Number(balance?.balance ?? 0);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let finalBankAccountId = bank_account_id || null;
    let finalCompanyId = company_id ?? null;

    if (mode === "new_account") {
      const name = (account_name || "Conta Asaas").slice(0, 80);
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

    const { encrypted, iv } = await encryptApiKey(api_key);

    const { data: integration, error: intErr } = await admin
      .from("asaas_integrations")
      .insert({
        user_id: userId,
        company_id: finalCompanyId,
        bank_account_id: finalBankAccountId,
        api_key_encrypted: encrypted,
        api_key_iv: iv,
        initial_balance_synced: initialBalance,
        sync_status: "idle",
      })
      .select()
      .single();

    if (intErr) {
      return new Response(JSON.stringify({ error: intErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ integration, balance: initialBalance }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("connect error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

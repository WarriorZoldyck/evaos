import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptApiKey } from "../_shared/asaas-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN_URL = {
  sandbox: "https://sts.itau.com.br/api/oauth/token",
  production: "https://sts.itau.com.br/api/oauth/token",
};

async function validateCredentials(clientId: string, clientSecret: string, env: "sandbox" | "production") {
  // Itaú OAuth client_credentials. Production requires mTLS — Deno fetch cannot present a client
  // cert without explicit client config; we only smoke-test sandbox here. Production validation is
  // deferred to itau-sync, which will surface mTLS errors clearly.
  if (env === "production") return { ok: true, skipped: true };
  try {
    const res = await fetch(TOKEN_URL.sandbox, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Itaú STS retornou ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

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
      client_id, client_secret, certificate, environment,
      agency, account_number, account_digit,
      mode, bank_account_id, account_name, company_id,
    } = body as Record<string, any>;

    if (!client_id || !client_secret) {
      return new Response(JSON.stringify({ error: "client_id e client_secret obrigatórios" }), { status: 400, headers: corsHeaders });
    }
    const env: "sandbox" | "production" = environment === "production" ? "production" : "sandbox";
    if (env === "production" && !certificate) {
      return new Response(JSON.stringify({ error: "Certificado mTLS é obrigatório para produção" }), { status: 400, headers: corsHeaders });
    }
    if (!["new_account", "link_existing"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Modo inválido" }), { status: 400, headers: corsHeaders });
    }

    const v = await validateCredentials(client_id, client_secret, env);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.error || "Credenciais Itaú inválidas" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let finalBankAccountId: string | null = bank_account_id || null;
    let finalCompanyId: string | null = company_id ?? null;

    if (mode === "new_account") {
      const name = (account_name || "Conta Itaú").slice(0, 80);
      const { data: acc, error: accErr } = await admin
        .from("bank_accounts")
        .insert({ user_id: userId, name, type: "Conta Corrente", initial_balance: 0, company_id: finalCompanyId })
        .select().single();
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
        .from("bank_accounts").select("id, company_id, user_id").eq("id", finalBankAccountId).maybeSingle();
      if (accErr || !acc || acc.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Conta bancária inválida" }), { status: 400, headers: corsHeaders });
      }
      finalCompanyId = acc.company_id;
    }

    const sec = await encryptApiKey(client_secret);
    const cert = certificate ? await encryptApiKey(certificate) : null;

    const { data: integration, error: intErr } = await admin
      .from("itau_integrations")
      .insert({
        user_id: userId,
        company_id: finalCompanyId,
        bank_account_id: finalBankAccountId,
        client_id,
        client_secret_encrypted: sec.encrypted,
        client_secret_iv: sec.iv,
        certificate_encrypted: cert?.encrypted ?? null,
        certificate_iv: cert?.iv ?? null,
        agency: agency || null,
        account_number: account_number || null,
        account_digit: account_digit || null,
        environment: env,
        sync_status: "idle",
      })
      .select().single();

    if (intErr) {
      return new Response(JSON.stringify({ error: intErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ integration }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("itau-connect error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

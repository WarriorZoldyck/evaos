import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stub: real Itaú Open Finance extract requires mTLS (client cert handshake), which Deno's
// default fetch does not support without a custom HTTPS client. This function marks the
// integration as attempted and returns a clear message so the UI flow exists end-to-end.
// When mTLS is wired (e.g. via a proxy or Deno HTTPS client lib), replace the body of `runSync`.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const integration_id = (body as any).integration_id as string | undefined;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const q = admin.from("itau_integrations").select("id, environment").eq("user_id", userId);
    const { data: rows, error } = integration_id ? await q.eq("id", integration_id) : await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    const message = "Sincronização Itaú ainda requer configuração de mTLS no servidor. Credenciais salvas com sucesso.";
    for (const r of rows ?? []) {
      await admin.from("itau_integrations").update({
        last_sync_at: new Date().toISOString(),
        sync_status: "pending_mtls",
        last_error: message,
      }).eq("id", r.id);
    }

    return new Response(JSON.stringify({ ok: true, processed: rows?.length ?? 0, message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ error: "Sem assinatura ativa" }), { status: 404, headers: corsHeaders });
    }

    if (sub.asaas_subscription_id) {
      const r = await fetch(`https://api.asaas.com/v3/subscriptions/${sub.asaas_subscription_id}`, {
        method: "DELETE",
        headers: { access_token: Deno.env.get("ASAAS_API_KEY")!, "User-Agent": "EVA OS" },
      });
      if (!r.ok) {
        const err = await r.text();
        console.error("Asaas delete error", err);
      }
    }

    await admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", sub.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

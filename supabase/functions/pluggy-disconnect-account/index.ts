import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPluggyApiKey, pluggyDelete } from "../_shared/pluggy.ts";

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

    const { integration_id } = await req.json();
    if (!integration_id) {
      return new Response(JSON.stringify({ error: "integration_id obrigatório" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integ } = await admin
      .from("pluggy_integrations")
      .select("id, user_id, pluggy_item_id")
      .eq("id", integration_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!integ) {
      return new Response(JSON.stringify({ error: "Integração não encontrada" }), { status: 404, headers: corsHeaders });
    }

    // best-effort remove on Pluggy side
    try {
      const apiKey = await getPluggyApiKey();
      await pluggyDelete(`/items/${integ.pluggy_item_id}`, apiKey);
    } catch (e) {
      console.warn("Pluggy delete item failed (continuing):", (e as Error).message);
    }

    const { error } = await admin
      .from("pluggy_integrations")
      .delete()
      .eq("id", integration_id)
      .eq("user_id", userId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

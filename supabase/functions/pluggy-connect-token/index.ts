import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPluggyApiKey, pluggyPost } from "../_shared/pluggy.ts";

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

    const body = await req.json().catch(() => ({}));
    const itemId: string | undefined = body?.item_id; // for "update" flow (reconnect)

    const apiKey = await getPluggyApiKey();

    // Generate connect_token. Optionally limit to Itaú connectors via webhookUrl
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/pluggy-webhook`;

    const tokenBody: Record<string, unknown> = {
      options: {
        clientUserId: userId,
        webhookUrl,
      },
    };
    if (itemId) (tokenBody as any).itemId = itemId;

    const tokenRes = await pluggyPost("/connect_token", apiKey, tokenBody);

    return new Response(
      JSON.stringify({ accessToken: tokenRes?.accessToken }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("pluggy-connect-token error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

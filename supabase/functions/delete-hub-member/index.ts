import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const ownerId = claimsData.claims.sub;
    const { memberId } = await req.json();
    if (!memberId) return json({ error: "memberId required" }, 400);

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership
    const { data: member } = await admin
      .from("workspace_members")
      .select("id, owner_id, member_user_id, created_by_hub")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || member.owner_id !== ownerId) {
      return json({ error: "Membro não encontrado" }, 404);
    }

    // Remove permissions + membership row → revoga acesso imediato a este hub
    await admin.from("workspace_member_permissions").delete().eq("workspace_member_id", memberId);
    await admin.from("workspace_members").delete().eq("id", memberId);

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

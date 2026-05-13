import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const ownerId = claimsData.claims.sub;
    const { memberId, status } = await req.json();
    if (!memberId || !["active", "suspended"].includes(status)) return json({ error: "invalid params" }, 400);

    const admin = createClient(url, svc);
    const { data: member } = await admin
      .from("workspace_members")
      .select("id, owner_id, member_user_id")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || member.owner_id !== ownerId) return json({ error: "Membro não encontrado" }, 404);

    const { error } = await admin.from("workspace_members").update({ status }).eq("id", memberId);
    if (error) return json({ error: error.message }, 500);

    if (status === "suspended") {
      try { await admin.auth.admin.signOut(member.member_user_id, "global"); } catch (_) {}
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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
    const { memberId } = await req.json();
    if (!memberId) return json({ error: "memberId required" }, 400);

    const admin = createClient(url, svc);

    const { data: member } = await admin
      .from("workspace_members")
      .select("id, owner_id, member_user_id, email, created_by_hub")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || member.owner_id !== ownerId) return json({ error: "Membro não encontrado" }, 404);

    // SECURITY: only allow password reset for members whose account was CREATED by this hub.
    // Pre-existing EVA users (invited by email) keep full control of their own credentials.
    if (!member.created_by_hub) {
      return json({
        error: "Este usuário já tinha conta na EVA antes do convite. Por segurança, apenas ele pode alterar a própria senha. Você pode remover o acesso ao seu hub, mas não pode redefinir a senha dele.",
      }, 403);
    }

    // Generate a new temp password
    const tempPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(member.member_user_id, { password: tempPassword });
    if (error) return json({ error: error.message }, 500);

    // Force re-login on all devices
    try { await admin.auth.admin.signOut(member.member_user_id, "global"); } catch (_) {}

    // Audit log
    try {
      await admin.from("hub_audit_log").insert({
        actor_user_id: ownerId,
        owner_id: ownerId,
        action: "member_password_reset",
        resource_type: "workspace_member",
        resource_id: memberId,
        payload: { member_email: member.email },
      });
    } catch (_) {}

    return json({ ok: true, tempPassword });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function generateTempPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (const v of arr) p += chars[v % chars.length];
  return p;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

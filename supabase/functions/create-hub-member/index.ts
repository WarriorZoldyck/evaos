import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate owner JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = claimsData.claims.sub;

    // Check the caller is NOT a hub member themselves (use app_metadata which is not user-writable)
    const ownerAppMeta = claimsData.claims.app_metadata as Record<string, unknown> | undefined;
    const ownerUserMeta = claimsData.claims.user_metadata as Record<string, unknown> | undefined;
    if (ownerAppMeta?.hub_member === true || ownerUserMeta?.hub_member === true) {
      return new Response(
        JSON.stringify({ error: "Hub members cannot create other members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "name, email, password and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "editor", "viewer"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to create user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // === Plan limit enforcement: max_hub_members ===
    const { data: subRow } = await adminClient
      .from("subscriptions")
      .select("status, trial_ends_at, plan:subscription_plans(max_hub_members)")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const inTrial = subRow?.status === "trialing" && subRow.trial_ends_at && new Date(subRow.trial_ends_at).getTime() > Date.now();
    const maxHubMembers: number = inTrial ? 3 : ((subRow?.plan as any)?.max_hub_members ?? 0);
    if (maxHubMembers <= 0) {
      return new Response(
        JSON.stringify({ error: "O EVA Hub é exclusivo do plano Família. Faça upgrade para adicionar membros." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { count: currentMembers } = await adminClient
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("status", "active");
    if ((currentMembers ?? 0) >= maxHubMembers) {
      return new Response(
        JSON.stringify({ error: `Limite de ${maxHubMembers} membros atingido no seu plano. Compre usuários extras para adicionar mais.` }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user with hub_member metadata
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        hub_member: true,
        owner_id: ownerId,
      },
      user_metadata: {
        full_name: name,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert workspace_members record
    const { error: memberError } = await adminClient
      .from("workspace_members")
      .insert({
        owner_id: ownerId,
        member_user_id: newUser.user.id,
        member_name: name,
        email,
        role,
        status: "active",
      });

    if (memberError) {
      console.error("Error inserting workspace member:", memberError);
      // Try to clean up the created user
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          id: newUser.user.id,
          email,
          name,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

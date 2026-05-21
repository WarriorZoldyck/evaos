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

    if (!name || !email || !role) {
      return new Response(
        JSON.stringify({ error: "name, email e role são obrigatórios" }),
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
      .in("status", ["active", "pending"]);
    if ((currentMembers ?? 0) >= maxHubMembers) {
      return new Response(
        JSON.stringify({ error: `Limite de ${maxHubMembers} membros atingido no seu plano. Compre usuários extras para adicionar mais.` }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Try to find existing EVA user by email ===
    const normalizedEmail = String(email).trim().toLowerCase();
    let existingUserId: string | null = null;
    try {
      // Scan paginated list (workaround: no direct getUserByEmail)
      let page = 1;
      const perPage = 1000;
      while (page <= 20) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (listErr) break;
        const match = list.users.find(
          (u: any) => String(u.email || "").toLowerCase() === normalizedEmail
        );
        if (match) { existingUserId = match.id; break; }
        if (!list.users || list.users.length < perPage) break;
        page += 1;
      }
    } catch (e) {
      console.error("listUsers failed:", e);
    }

    // === Path A: existing user → pending invitation ===
    if (existingUserId) {
      if (existingUserId === ownerId) {
        return new Response(
          JSON.stringify({ error: "Você não pode convidar a si mesmo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check duplicate membership
      const { data: existingMembership } = await adminClient
        .from("workspace_members")
        .select("id, status")
        .eq("owner_id", ownerId)
        .eq("member_user_id", existingUserId)
        .maybeSingle();
      if (existingMembership) {
        const msg = existingMembership.status === "pending"
          ? "Este usuário já tem um convite pendente."
          : "Este usuário já é membro do seu hub.";
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: memberError } = await adminClient
        .from("workspace_members")
        .insert({
          owner_id: ownerId,
          member_user_id: existingUserId,
          member_name: name,
          email: normalizedEmail,
          role,
          status: "pending",
        });

      if (memberError) {
        console.error("Error inserting pending member:", memberError);
        return new Response(
          JSON.stringify({ error: memberError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          pending: true,
          member: { id: existingUserId, email: normalizedEmail, name, role },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Path B: new user → create auth user with password (legacy flow) ===
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Defina uma senha para criar um novo usuário (este e-mail ainda não tem conta na EVA)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
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
      const isEmailExists =
        (createError as any)?.code === "email_exists" ||
        /already.*registered|already.*exists/i.test(createError.message || "");
      const friendly = isEmailExists
        ? "Este e-mail já está cadastrado na plataforma. Tente novamente — agora ele será convidado como membro existente."
        : createError.message;
      return new Response(
        JSON.stringify({ error: friendly }),
        { status: isEmailExists ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: memberError } = await adminClient
      .from("workspace_members")
      .insert({
        owner_id: ownerId,
        member_user_id: newUser.user.id,
        member_name: name,
        email: normalizedEmail,
        role,
        status: "active",
      });

    if (memberError) {
      console.error("Error inserting workspace member:", memberError);
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

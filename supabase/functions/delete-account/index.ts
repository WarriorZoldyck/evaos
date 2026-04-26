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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const now = new Date().toISOString();

    // Use service role to soft-delete all user data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Soft delete: set deleted_at on all tables
    const tables = [
      "pricing_procedure_items",
      "pricing_procedures",
      "pricing_configurations",
      "pricing_v2_procedure_items",
      "pricing_v2_procedures",
      "pricing_v2_cost_items",
      "pricing_v2_configurations",
      "goal_movements",
      "goals",
      "recurring_transactions",
      "transactions",
      "card_terminals",
      "credit_cards",
      "wallets",
      "bank_accounts",
      "categories",
      "clients",
      "suppliers",
      "companies",
      "whatsapp_pending_actions",
      "profiles",
    ];

    for (const table of tables) {
      const col = table === "profiles" ? "id" : "user_id";
      const { error } = await adminClient
        .from(table)
        .update({ deleted_at: now })
        .eq(col, userId)
        .is("deleted_at", null);
      if (error) {
        console.error(`Error soft-deleting from ${table}:`, error.message);
      }
    }

    // Ban the user instead of deleting (preserves data for 30 days)
    const { error: banError } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: "876000h" }
    );
    if (banError) {
      return new Response(JSON.stringify({ error: banError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

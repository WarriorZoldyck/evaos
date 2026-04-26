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

  // --- Auth check: require a secret cron header ---
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find profiles soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredProfiles, error: fetchError } = await adminClient
      .from("profiles")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", thirtyDaysAgo);

    if (fetchError) {
      throw new Error(`Failed to fetch expired profiles: ${fetchError.message}`);
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return new Response(JSON.stringify({ purged: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    let purgedCount = 0;

    for (const profile of expiredProfiles) {
      const userId = profile.id;

      for (const table of tables) {
        const col = table === "profiles" ? "id" : "user_id";
        const { error } = await adminClient
          .from(table)
          .delete()
          .eq(col, userId);
        if (error) {
          console.error(`Error purging ${table} for ${userId}:`, error.message);
        }
      }

      // Now hard-delete the auth user
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error(`Error deleting auth user ${userId}:`, deleteError.message);
      } else {
        purgedCount++;
      }
    }

    return new Response(JSON.stringify({ purged: purgedCount }), {
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

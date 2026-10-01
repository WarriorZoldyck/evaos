import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Find all legacy wallets (old naming: "Conta Kids", "Eva Kids", etc.)
    // New naming is "Kids - <name>", those we keep.
    const { data: legacyWallets, error: fetchErr } = await admin
      .from("wallets")
      .select("id, name, user_id")
      .or("name.eq.Conta Kids,name.eq.Eva Kids,name.eq.eva kids,name.eq.conta kids");

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!legacyWallets || legacyWallets.length === 0) {
      return new Response(JSON.stringify({ message: "No legacy wallets found", deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletIds = legacyWallets.map((w: any) => w.id);

    // Delete linked transactions first
    const { data: deletedTxns, error: txDelErr } = await admin
      .from("transactions")
      .delete()
      .in("wallet_id", walletIds)
      .select("id");

    if (txDelErr) {
      return new Response(JSON.stringify({ error: "Failed to delete transactions: " + txDelErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete the wallets
    const { error: delErr } = await admin
      .from("wallets")
      .delete()
      .in("id", walletIds);

    if (delErr) {
      return new Response(JSON.stringify({ error: "Failed to delete wallets: " + delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Cleanup complete",
        walletsDeleted: legacyWallets.length,
        walletNames: legacyWallets.map((w: any) => w.name),
        transactionsDeleted: deletedTxns?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

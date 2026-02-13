import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RateInfo {
  installments: number;
  rate: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch all transactions with a card terminal
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, original_amount, payment_method, installments, competence_date, payment_date, card_terminal_id, description")
      .not("card_terminal_id", "is", null);

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ message: "No terminal transactions found", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch all terminals
    const terminalIds = [...new Set(transactions.map((t) => t.card_terminal_id))];
    const { data: terminals, error: termError } = await supabase
      .from("card_terminals")
      .select("id, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info")
      .in("id", terminalIds);

    if (termError) throw termError;

    const terminalMap = new Map(terminals?.map((t) => [t.id, t]) ?? []);

    const results: Array<{ id: string; description: string; action: string; oldAmount?: number; newAmount?: number; oldDate?: string; newDate?: string }> = [];

    for (const tx of transactions) {
      const terminal = terminalMap.get(tx.card_terminal_id);
      if (!terminal) {
        results.push({ id: tx.id, description: tx.description, action: "SKIPPED - terminal not found" });
        continue;
      }

      const originalAmount = tx.original_amount ?? tx.amount;
      const alreadyCorrected = tx.original_amount != null && tx.original_amount !== tx.amount;

      // Determine rate
      const isDebit = tx.payment_method === "Cartão de Débito";
      let rate: number;
      let settlementDays: number;

      if (isDebit) {
        rate = terminal.debit_rate ?? 0;
        settlementDays = terminal.settlement_days_debit ?? 1;
      } else {
        // Credit - check installments
        const installments = tx.installments ?? 1;
        if (installments >= 2 && terminal.rates_info) {
          try {
            const rates: RateInfo[] = JSON.parse(terminal.rates_info);
            const found = rates.find((r) => r.installments === installments);
            rate = found ? found.rate : (terminal.credit_rate ?? 0);
          } catch {
            rate = terminal.credit_rate ?? 0;
          }
        } else {
          rate = terminal.credit_rate ?? 0;
        }
        settlementDays = terminal.settlement_days_credit ?? 2;
      }

      // Calculate new values
      const feeAmount = Math.round(originalAmount * (rate / 100) * 100) / 100;
      const netAmount = Math.round((originalAmount - feeAmount) * 100) / 100;

      // Calculate settlement date
      const competenceDate = new Date(tx.competence_date + "T00:00:00Z");
      competenceDate.setUTCDate(competenceDate.getUTCDate() + settlementDays);
      const newPaymentDate = competenceDate.toISOString().split("T")[0];

      // Build update
      const update: Record<string, unknown> = {
        payment_date: newPaymentDate,
      };

      if (!alreadyCorrected) {
        update.original_amount = originalAmount;
        update.amount = netAmount;
      }

      const { error: updateError } = await supabase
        .from("transactions")
        .update(update)
        .eq("id", tx.id);

      if (updateError) {
        results.push({ id: tx.id, description: tx.description, action: `ERROR: ${updateError.message}` });
        continue;
      }

      results.push({
        id: tx.id,
        description: tx.description,
        action: alreadyCorrected ? "DATE_ONLY" : "CORRECTED",
        oldAmount: tx.amount,
        newAmount: alreadyCorrected ? tx.amount : netAmount,
        oldDate: tx.payment_date,
        newDate: newPaymentDate,
      });
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${transactions.length} transactions`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch all transactions with a card terminal
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, original_amount, payment_method, installments, competence_date, payment_date, card_terminal_id, description, series_id, installment_number, installments_total")
      .eq("user_id", userId)
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

    // Group transactions: if a tx has installments >= 2 and is credit and has NO series_id,
    // it's an old-style single transaction that needs to be split into N installments
    for (const tx of transactions) {
      const terminal = terminalMap.get(tx.card_terminal_id);
      if (!terminal) {
        results.push({ id: tx.id, description: tx.description, action: "SKIPPED - terminal not found" });
        continue;
      }

      const isDebit = tx.payment_method === "Cartão de Débito";
      const isCredit = tx.payment_method === "Cartão de Crédito";
      const installmentsCount = tx.installments ?? 1;
      const hasSeriesId = !!tx.series_id;
      const isOldStyleInstallment = isCredit && installmentsCount >= 2 && !hasSeriesId;

      // Determine rate
      let rate: number;
      let settlementDays: number;

      if (isDebit) {
        rate = terminal.debit_rate ?? 0;
        settlementDays = terminal.settlement_days_debit ?? 1;
      } else {
        if (installmentsCount >= 2 && terminal.rates_info) {
          try {
            const rates: RateInfo[] = JSON.parse(terminal.rates_info);
            const found = rates.find((r) => r.installments === installmentsCount);
            rate = found ? found.rate : (terminal.credit_rate ?? 0);
          } catch {
            rate = terminal.credit_rate ?? 0;
          }
        } else {
          rate = terminal.credit_rate ?? 0;
        }
        settlementDays = terminal.settlement_days_credit ?? 2;
      }

      if (isOldStyleInstallment) {
        // SPLIT: Delete old single transaction and create N installment transactions
        const originalAmount = tx.original_amount ?? tx.amount;
        // Recalculate: the original_amount might already be the net (if previously corrected)
        // We need the true gross amount. If original_amount exists and differs from amount, 
        // original_amount IS the gross. If they're equal, amount is gross (uncorrected).
        const grossTotal = tx.original_amount && tx.original_amount !== tx.amount
          ? tx.original_amount
          : tx.amount;

        // But if already corrected (amount = net), we need to reverse-engineer the gross
        // Actually: if original_amount exists, it IS the gross per the system convention
        const trueGross = tx.original_amount ?? tx.amount;

        const grossPerInstallment = Math.round((trueGross / installmentsCount) * 100) / 100;
        const feePerInstallment = Math.round(grossPerInstallment * (rate / 100) * 100) / 100;
        const netPerInstallment = Math.round((grossPerInstallment - feePerInstallment) * 100) / 100;
        const competenceDate = new Date(tx.competence_date + "T00:00:00Z");
        const seriesId = crypto.randomUUID();

        // Fetch full transaction data to preserve all fields
        const { data: fullTx, error: fullTxError } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", tx.id)
          .single();

        if (fullTxError || !fullTx) {
          results.push({ id: tx.id, description: tx.description, action: `ERROR: Could not fetch full transaction` });
          continue;
        }

        // Create N installment transactions
        const newTransactions = [];
        for (let i = 0; i < installmentsCount; i++) {
          const payDate = addCalendarDays(competenceDate, settlementDays * (i + 1));
          newTransactions.push({
            user_id: fullTx.user_id,
            company_id: fullTx.company_id,
            type: fullTx.type,
            description: fullTx.description,
            amount: netPerInstallment,
            original_amount: grossPerInstallment,
            payment_date: payDate.toISOString().split("T")[0],
            competence_date: tx.competence_date,
            status: fullTx.status,
            category: fullTx.category,
            subcategory: fullTx.subcategory,
            subcategory2: fullTx.subcategory2,
            payment_method: fullTx.payment_method,
            bank_account_id: fullTx.bank_account_id,
            credit_card_id: fullTx.credit_card_id,
            wallet_id: fullTx.wallet_id,
            card_terminal_id: fullTx.card_terminal_id,
            supplier_id: fullTx.supplier_id,
            client_id: fullTx.client_id,
            contact_name: fullTx.contact_name,
            notes: fullTx.notes,
            barcode: fullTx.barcode,
            attachment_url: fullTx.attachment_url,
            series_id: seriesId,
            installment_number: i + 1,
            installments_total: installmentsCount,
            installments: installmentsCount,
          });
        }

        // Insert new installments
        const { error: insertError } = await supabase
          .from("transactions")
          .insert(newTransactions);

        if (insertError) {
          results.push({ id: tx.id, description: tx.description, action: `ERROR inserting installments: ${insertError.message}` });
          continue;
        }

        // Delete old single transaction
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", tx.id);

        if (deleteError) {
          results.push({ id: tx.id, description: tx.description, action: `ERROR deleting old tx: ${deleteError.message}` });
          continue;
        }

        results.push({
          id: tx.id,
          description: tx.description,
          action: `SPLIT into ${installmentsCount} installments (series: ${seriesId})`,
          oldAmount: tx.amount,
          newAmount: netPerInstallment,
        });
      } else if (hasSeriesId) {
        // Already split into installments - just fix amount/date per installment
        const grossPerInstallment = tx.original_amount ?? tx.amount;
        const feePerInstallment = Math.round(grossPerInstallment * (rate / 100) * 100) / 100;
        const netPerInstallment = Math.round((grossPerInstallment - feePerInstallment) * 100) / 100;
        const installmentNum = tx.installment_number ?? 1;
        const competenceDate = new Date(tx.competence_date + "T00:00:00Z");

        let newPaymentDate: string;
        if (isDebit) {
          newPaymentDate = addBusinessDays(competenceDate, settlementDays).toISOString().split("T")[0];
        } else {
          newPaymentDate = addCalendarDays(competenceDate, settlementDays * installmentNum).toISOString().split("T")[0];
        }

        const update: Record<string, unknown> = {
          amount: netPerInstallment,
          original_amount: grossPerInstallment,
          payment_date: newPaymentDate,
        };

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
          action: "UPDATED_INSTALLMENT",
          oldAmount: tx.amount,
          newAmount: netPerInstallment,
          oldDate: tx.payment_date,
          newDate: newPaymentDate,
        });
      } else {
        // Single transaction (debit or credit à vista) - fix amount and date
        const originalAmount = tx.original_amount ?? tx.amount;
        const feeAmount = Math.round(originalAmount * (rate / 100) * 100) / 100;
        const netAmount = Math.round((originalAmount - feeAmount) * 100) / 100;
        const competenceDate = new Date(tx.competence_date + "T00:00:00Z");

        let newPaymentDate: string;
        if (isDebit || settlementDays <= 2) {
          newPaymentDate = addBusinessDays(competenceDate, settlementDays).toISOString().split("T")[0];
        } else {
          newPaymentDate = addCalendarDays(competenceDate, settlementDays).toISOString().split("T")[0];
        }

        const update: Record<string, unknown> = {
          amount: netAmount,
          original_amount: originalAmount,
          payment_date: newPaymentDate,
        };

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
          action: "CORRECTED_SINGLE",
          oldAmount: tx.amount,
          newAmount: netAmount,
          oldDate: tx.payment_date,
          newDate: newPaymentDate,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${transactions.length} transactions`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

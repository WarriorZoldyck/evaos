import { useEffect, useMemo, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export type CycleTotalsMap = Map<string, Map<string, number>>;

/**
 * Fetches per-card, per-cycle totals for the previous, current and next
 * billing months (grouped by YYYY-MM of payment_date). Independent of the
 * Dashboard period filter so navigation between faturas always reflects
 * actual invoice values (matches CreditCardBillPaymentModal).
 * Sign: despesa +, receita −.
 */
export function useCreditCardCycleTotals(cardIds: string[]) {
  const effectiveUserId = useEffectiveUserId();
  const [totals, setTotals] = useState<CycleTotalsMap>(new Map());
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(() => [...cardIds].sort().join(","), [cardIds]);

  const fetchTotals = useCallback(async () => {
    if (!effectiveUserId || !idsKey) {
      setTotals(new Map());
      return;
    }
    const ids = idsKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setTotals(new Map());
      return;
    }

    setLoading(true);
    const now = new Date();
    const startStr = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    const endStr = format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("transactions")
      .select("credit_card_id, payment_date, type, amount")
      .in("credit_card_id", ids)
      .gte("payment_date", startStr)
      .lte("payment_date", endStr)
      .is("transfer_id", null)
      .or("payment_method.is.null,payment_method.neq.Cartão de Débito");

    if (error || !data) {
      setLoading(false);
      return;
    }

    const m: CycleTotalsMap = new Map();
    for (const t of data) {
      if (!t.credit_card_id || !t.payment_date) continue;
      const cycleKey = String(t.payment_date).slice(0, 7);
      const inner = m.get(t.credit_card_id) ?? new Map<string, number>();
      const cur = inner.get(cycleKey) || 0;
      const signed = t.type === "despesa" ? Number(t.amount) : -Number(t.amount);
      inner.set(cycleKey, cur + signed);
      m.set(t.credit_card_id, inner);
    }
    setTotals(m);
    setLoading(false);
  }, [effectiveUserId, idsKey]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  return { totals, loading, refetch: fetchTotals };
}

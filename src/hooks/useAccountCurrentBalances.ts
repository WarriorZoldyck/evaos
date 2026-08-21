import { useEffect, useState, useCallback } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

interface AccountLike {
  id: string;
  initial_balance: number | string | null;
}

/**
 * Returns a Map<accountId, currentBalance> where currentBalance =
 * initial_balance + Σ(receita − despesa) of Pago transactions, computed
 * server-side via `get_account_prior_balance` (SECURITY DEFINER, not
 * capped by PostgREST's 1000-row limit).
 *
 * `type` selects which SQL function branch is used (bank vs wallet).
 */
export function useAccountCurrentBalances(
  accounts: AccountLike[],
  type: "bank" | "wallet",
  throughDate?: Date,
) {
  const effectiveUserId = useEffectiveUserId();
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const idsKey = accounts.map((a) => a.id).sort().join(",");

  const fetchBalances = useCallback(async () => {
    if (!effectiveUserId || accounts.length === 0) {
      setBalances(new Map());
      return;
    }
    setLoading(true);
    // The RPC uses payment_date < date_from. Historical dashboard periods pass
    // their end date here; otherwise payments up to today are included.
    const referenceDate = throughDate && throughDate < new Date() ? throughDate : new Date();
    const dateFrom = format(addDays(referenceDate, 1), "yyyy-MM-dd");
    const results = await Promise.all(
      accounts.map(async (a) => {
        const { data, error } = await supabase.rpc("get_account_prior_balance", {
          account_id_param: a.id,
          account_type_param: type,
          date_from: dateFrom,
        });
        const delta = !error && data !== null && data !== undefined ? Number(data) : 0;
        const current = Number(a.initial_balance ?? 0) + delta;
        return [a.id, current] as const;
      }),
    );
    setBalances(new Map(results));
    setLoading(false);
  }, [effectiveUserId, idsKey, type, throughDate?.getTime()]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, refetch: fetchBalances };
}

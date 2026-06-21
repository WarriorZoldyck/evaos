import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  pickBestMatch,
  DATE_WINDOW_DAYS,
  type CandidateTx,
  type StatementLine,
  type ScoredCandidate,
} from "@/lib/import/matching";

export interface RowMatch {
  best: ScoredCandidate | null;
  alternatives: CandidateTx[]; // other candidates (max 5)
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hook to find best-match suggestions for parsed statement lines against
 * existing transactions (Pendente or Pago) for a given destination —
 * either a bank account/wallet (debit) or a credit card.
 */
export function useImportMatching() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Record<number, RowMatch>>({});

  const findMatches = useCallback(
    async (
      lines: StatementLine[],
      bankAccountId: string | null,
      walletId: string | null,
      creditCardId: string | null = null,
      options: { merge?: boolean } = {},
    ) => {
      if (lines.length === 0 || (!bankAccountId && !walletId && !creditCardId)) {
        if (!options.merge) setMatches({});
        return {};
      }


      setLoading(true);
      try {
        const dates = lines.map((l) => l.date).sort();
        const minDate = shiftISO(dates[0], -DATE_WINDOW_DAYS);
        const maxDate = shiftISO(dates[dates.length - 1], DATE_WINDOW_DAYS);

        // Get unique amounts to narrow the query
        const uniqAmounts = Array.from(new Set(lines.map((l) => Math.abs(l.amount))));

        let query = supabase
          .from("transactions")
          .select(
            "id, description, amount, payment_date, type, status, category, contact_name, series_id, installment_number, installments_total, credit_card_id"
          )
          .in("status", ["Pendente", "Pago"])
          .gte("payment_date", minDate)
          .lte("payment_date", maxDate)
          .in("amount", uniqAmounts);

        if (creditCardId) {
          query = query.eq("credit_card_id", creditCardId);
        } else {
          query = query.is("credit_card_id", null);
          if (bankAccountId) query = query.eq("bank_account_id", bankAccountId);
          if (walletId) query = query.eq("wallet_id", walletId);
        }

        const { data, error } = await query.limit(1000);
        if (error) {
          console.error("[useImportMatching] query error", error);
          setMatches({});
          return {};
        }

        const candidates = (data || []) as CandidateTx[];

        // Track which transaction IDs are already claimed to avoid double-binding
        const claimed = new Set<string>();
        const result: Record<number, RowMatch> = {};

        // Sort lines by date so earlier ones get first pick
        const order = lines
          .map((l, i) => ({ i, l }))
          .sort((a, b) => a.l.date.localeCompare(b.l.date));

        for (const { i, l } of order) {
          const available = candidates.filter((c) => !claimed.has(c.id));
          const best = pickBestMatch(l, available);
          const alternatives = available
            .filter((c) => c.id !== best?.candidate.id)
            .slice(0, 5);
          if (best) claimed.add(best.candidate.id);
          result[i] = { best, alternatives };
        }

        setMatches(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => setMatches({}), []);

  return { matches, findMatches, loading, reset };
}

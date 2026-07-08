import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  pickBestMatch,
  DATE_WINDOW_DAYS,
  CARD_DATE_WINDOW_DAYS,
  AMOUNT_TOLERANCE,
  type CandidateTx,
  type StatementLine,
  type ScoredCandidate,
} from "@/lib/import/matching";

export interface RowMatch {
  best: ScoredCandidate | null;
  alternatives: CandidateTx[];
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
        const isCard = !!creditCardId;
        const window = isCard ? Math.min(CARD_DATE_WINDOW_DAYS, 3) : DATE_WINDOW_DAYS;
        const dates = lines.map((l) => l.date).sort();
        const minDate = shiftISO(dates[0], -window);
        const maxDate = shiftISO(dates[dates.length - 1], window);

        const selectCols = "id, description, amount, payment_date, competence_date, purchase_date_original, type, status, category, subcategory, subcategory2, contact_name, series_id, installment_number, installments_total, credit_card_id";

        let query = supabase
          .from("transactions")
          .select(selectCols)
          .in("status", ["Pendente", "Pago"]);

        if (isCard) {
          query = query.or(
            `and(purchase_date_original.gte.${minDate},purchase_date_original.lte.${maxDate}),and(purchase_date_original.is.null,competence_date.gte.${minDate},competence_date.lte.${maxDate})`
          );
        } else {
          query = query.gte("payment_date", minDate).lte("payment_date", maxDate);
        }

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

        let rawCandidates = (data || []) as CandidateTx[];

        // Wave B (cartão): lançamentos SEM credit_card_id somente dentro do
        // escopo real de compras do extrato. Não expandir para fatura futura.
        if (isCard) {
          const wbMin = minDate;
          const wbMax = maxDate;
          const { data: wb, error: wbErr } = await supabase
            .from("transactions")
            .select(selectCols)
            .in("status", ["Pendente", "Pago"])
            .is("credit_card_id", null)
            .eq("type", "despesa")
            .or(
              `and(purchase_date_original.gte.${wbMin},purchase_date_original.lte.${wbMax}),and(competence_date.gte.${wbMin},competence_date.lte.${wbMax})`
            )
            .limit(2000);
          if (!wbErr && wb) {
            const existingIds = new Set(rawCandidates.map((c) => c.id));
            for (const t of wb as CandidateTx[]) {
              if (!existingIds.has(t.id)) rawCandidates.push(t);
            }
          }
        }



        // Amount filter applied in-memory using AMOUNT_TOLERANCE (covers ±0.02).
        const lineAmounts = lines.map((l) => Math.abs(l.amount));
        const candidates = rawCandidates.filter((c) =>
          lineAmounts.some((a) => Math.abs(c.amount - a) <= AMOUNT_TOLERANCE),
        );


        const claimed = new Set<string>();
        const result: Record<number, RowMatch> = {};

        // Sort lines by date so earlier ones get first pick
        const order = lines
          .map((l, i) => ({ i, l }))
          .sort((a, b) => a.l.date.localeCompare(b.l.date));

        const scoreOpts = { useCompetenceDate: isCard, dayWindow: window };

        for (const { i, l } of order) {
          const available = candidates.filter((c) => !claimed.has(c.id));
          const perLineOpts = {
            ...scoreOpts,
            lineInstallmentNumber: l.installment_number ?? null,
            lineInstallmentsTotal: l.installments_total ?? null,
          };
          const best = pickBestMatch(l, available, perLineOpts);
          const alternatives = available
            .filter((c) => c.id !== best?.candidate.id)
            .slice(0, 5);
          if (best) claimed.add(best.candidate.id);
          result[i] = { best, alternatives };
        }

        if (options.merge) {
          setMatches((prev) => ({ ...prev, ...result }));
        } else {
          setMatches(result);
        }
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

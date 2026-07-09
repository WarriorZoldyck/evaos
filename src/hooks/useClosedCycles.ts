import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { toast } from "@/hooks/use-toast";

export interface ClosedCycle {
  id: string;
  credit_card_id: string | null;
  bank_account_id: string | null;
  cycle_key: string; // YYYY-MM
  closed_at: string;
  closed_by: string;
  note: string | null;
}

/**
 * Returns closed bill/month cycles for the current effective user, plus helpers
 * to close/reopen a cycle. Cycle key = "YYYY-MM" of the transaction payment_date.
 */
export function useClosedCycles() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const [cycles, setCycles] = useState<ClosedCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("closed_bill_cycles")
      .select("id, credit_card_id, bank_account_id, cycle_key, closed_at, closed_by, note")
      .eq("user_id", effectiveUserId);
    if (!error && data) setCycles(data as ClosedCycle[]);
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCardCycleClosed = useCallback(
    (cardId: string, cycleKey: string) =>
      cycles.find((c) => c.credit_card_id === cardId && c.cycle_key === cycleKey) || null,
    [cycles],
  );

  const isAccountCycleClosed = useCallback(
    (accountId: string, cycleKey: string) =>
      cycles.find((c) => c.bank_account_id === accountId && c.cycle_key === cycleKey) || null,
    [cycles],
  );

  const closeCycle = useCallback(
    async (params: { credit_card_id?: string; bank_account_id?: string; cycle_key: string; note?: string }) => {
      if (!effectiveUserId || !user) return false;
      const { error } = await supabase.from("closed_bill_cycles").insert({
        user_id: effectiveUserId,
        credit_card_id: params.credit_card_id ?? null,
        bank_account_id: params.bank_account_id ?? null,
        cycle_key: params.cycle_key,
        closed_by: user.id,
        note: params.note ?? null,
      });
      if (error) {
        toast({ title: "Erro ao fechar mês", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Mês fechado", description: "Nenhum lançamento pode entrar ou sair até reabrir." });
      await refresh();
      return true;
    },
    [effectiveUserId, user, refresh],
  );

  const reopenCycle = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("closed_bill_cycles").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao reabrir", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Mês reaberto", description: "Lançamentos podem ser editados novamente." });
      await refresh();
      return true;
    },
    [refresh],
  );

  return { cycles, loading, refresh, isCardCycleClosed, isAccountCycleClosed, closeCycle, reopenCycle };
}

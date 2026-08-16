import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { useCashFlowMonthly } from "@/hooks/useCashFlowMonthly";
import type { DRECategoryRow } from "@/hooks/useDREData";

export interface CategoryBreakdown {
  name: string;
  /** Média mensal do ano corrente. */
  total: number;
  /** Total já efetivado (pago) no mês corrente. */
  monthTotal: number;
}

export interface MetasSidebarStats {
  loading: boolean;
  totalBalance: number;
  avgIncomeMonth: number;
  avgSpentMonth: number;
  /** Realizado do mês corrente. */
  incomeMonth: number;
  spentMonth: number;
  leftover: number;
  incomeCategories: CategoryBreakdown[];
  expenseCategories: CategoryBreakdown[];
  topCategories: CategoryBreakdown[];
  refetch: () => void;
}

const YEAR = new Date().getFullYear();
const CURRENT_PERIOD = `${YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

export function useMetasSidebarStats(): MetasSidebarStats {
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();

  const cashFlow = useCashFlowMonthly("caixa", { year: YEAR, granularity: "monthly" });

  const [balanceState, setBalanceState] = useState({ loading: true, totalBalance: 0 });
  const contextKey = isPersonal ? "personal" : selectedCompanyId || "none";

  const applyCtx = useCallback(
    (q: any) => {
      if (isPersonal) return q.is("company_id", null);
      if (selectedCompanyId) return q.eq("company_id", selectedCompanyId);
      return q;
    },
    [isPersonal, selectedCompanyId],
  );

  const fetchBalance = useCallback(async () => {
    if (!effectiveUserId) return;
    setBalanceState((s) => ({ ...s, loading: true }));

    const [banksRes, walletsRes] = await Promise.all([
      applyCtx(supabase.from("bank_accounts").select("id,initial_balance").eq("user_id", effectiveUserId)),
      applyCtx(supabase.from("wallets").select("id,initial_balance").eq("user_id", effectiveUserId)),
    ]);

    const banks = banksRes.data || [];
    const wallets = walletsRes.data || [];
    const bankIds = banks.map((b: any) => b.id);
    const walletIds = wallets.map((w: any) => w.id);

    const initialSum =
      banks.reduce((s: number, b: any) => s + Number(b.initial_balance || 0), 0) +
      wallets.reduce((s: number, w: any) => s + Number(w.initial_balance || 0), 0);

    let paidDelta = 0;
    if (bankIds.length > 0 || walletIds.length > 0) {
      const { data } = await supabase.rpc("get_accounts_paid_delta", {
        bank_ids: bankIds,
        wallet_ids: walletIds,
      });
      paidDelta = Number(data || 0);
    }
    setBalanceState({ loading: false, totalBalance: initialSum + paidDelta });
  }, [effectiveUserId, contextKey, applyCtx]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const derived = useMemo(() => {
    const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
    const monthsRemaining = Math.max(0, 12 - monthsElapsed);

    const sumTotals = (t: Record<string, number>) =>
      Object.values(t).reduce((s, v) => s + (Number(v) || 0), 0);

    const totalIncomeYear = sumTotals(cashFlow.monthlyRevenueTotals || {});
    const totalSpentYear = sumTotals(cashFlow.monthlyExpenseTotals || {});

    const avgIncomeMonth = totalIncomeYear / monthsElapsed;
    const avgSpentMonth = totalSpentYear / monthsElapsed;

    // Realizado do mês corrente — mesma fonte da média, então os números batem.
    const incomeMonth = Number((cashFlow.monthlyRevenueTotals || {})[CURRENT_PERIOD] || 0);
    const spentMonth = Number((cashFlow.monthlyExpenseTotals || {})[CURRENT_PERIOD] || 0);

    const rowsToCategories = (rows: DRECategoryRow[]): CategoryBreakdown[] =>
      rows
        .map((r) => ({
          name: r.categoryName,
          total: sumTotals(r.monthlyTotals) / monthsElapsed,
          monthTotal: Number(r.monthlyTotals?.[CURRENT_PERIOD] || 0),
        }))
        .filter((c) => c.total !== 0 || c.monthTotal !== 0)
        .sort((a, b) => b.total - a.total);

    const incomeCategories = rowsToCategories(cashFlow.revenueRows || []);
    const expenseCategories = rowsToCategories(cashFlow.expenseRows || []);
    const leftover =
      balanceState.totalBalance + (avgIncomeMonth - avgSpentMonth) * monthsRemaining;

    return {
      avgIncomeMonth,
      avgSpentMonth,
      incomeMonth,
      spentMonth,
      leftover,
      incomeCategories,
      expenseCategories,
      topCategories: expenseCategories.slice(0, 3),
    };
  }, [cashFlow.monthlyRevenueTotals, cashFlow.monthlyExpenseTotals, cashFlow.revenueRows, cashFlow.expenseRows, balanceState.totalBalance]);

  return {
    loading: cashFlow.loading || balanceState.loading,
    totalBalance: balanceState.totalBalance,
    ...derived,
    refetch: fetchBalance,
  };
}

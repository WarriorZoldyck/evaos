import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";

export interface TopCategory {
  name: string;
  total: number;
}

export interface MetasSidebarStats {
  loading: boolean;
  totalBalance: number;
  spentYear: number;
  projectedYearOut: number;
  leftover: number; // saldo - saídas pendentes até fim do ano
  topCategories: TopCategory[];
  totalIncomeYear: number;
  avgIncomeMonth: number;
  avgSpentMonth: number;
  allCategories: TopCategory[];
  refetch: () => void;
}

const YEAR = new Date().getFullYear();
const YEAR_START = `${YEAR}-01-01`;
const YEAR_END = `${YEAR}-12-31`;
const TODAY = new Date().toISOString().slice(0, 10);

export function useMetasSidebarStats(): MetasSidebarStats {
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();

  const [state, setState] = useState<Omit<MetasSidebarStats, "refetch">>({
    loading: true,
    totalBalance: 0,
    spentYear: 0,
    projectedYearOut: 0,
    leftover: 0,
    topCategories: [],
  });

  const contextKey = isPersonal ? "personal" : selectedCompanyId || "none";

  const applyCtx = useCallback(
    (q: any) => {
      if (isPersonal) return q.is("company_id", null);
      if (selectedCompanyId) return q.eq("company_id", selectedCompanyId);
      return q;
    },
    [isPersonal, selectedCompanyId],
  );

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return;
    setState((s) => ({ ...s, loading: true }));

    const [banksRes, walletsRes, txRes] = await Promise.all([
      applyCtx(supabase.from("bank_accounts").select("id,initial_balance").eq("user_id", effectiveUserId)),
      applyCtx(supabase.from("wallets").select("id,initial_balance").eq("user_id", effectiveUserId)),
      applyCtx(
        supabase
          .from("transactions")
          .select("amount,type,status,category,payment_date,is_internal_transfer,credit_card_id")
          .eq("user_id", effectiveUserId)
          .gte("payment_date", YEAR_START)
          .lte("payment_date", YEAR_END)
          .limit(5000),
      ),
    ]);

    const banks = banksRes.data || [];
    const wallets = walletsRes.data || [];
    const bankIds = banks.map((b: any) => b.id);
    const walletIds = wallets.map((w: any) => w.id);

    // Saldo atual: initial + delta pago via RPC (respeita RLS + evita limite 1000)
    const initialSum =
      banks.reduce((s: number, b: any) => s + Number(b.initial_balance || 0), 0) +
      wallets.reduce((s: number, w: any) => s + Number(w.initial_balance || 0), 0);

    let paidDelta = 0;
    if (bankIds.length > 0 || walletIds.length > 0) {
      const { data: deltaData } = await supabase.rpc("get_accounts_paid_delta", {
        bank_ids: bankIds,
        wallet_ids: walletIds,
      });
      paidDelta = Number(deltaData || 0);
    }
    const totalBalance = initialSum + paidDelta;

    // Transações do ano no contexto
    const txs = (txRes.data || []).filter((t: any) => !t.is_internal_transfer);
    let spentYear = 0;
    let projectedOut = 0;
    let pendingOutRemaining = 0;
    const catMap = new Map<string, number>();

    for (const t of txs) {
      const amt = Number(t.amount || 0);
      if (t.type !== "despesa") continue;
      if (t.status === "Pago") {
        spentYear += amt;
        projectedOut += amt;
        const key = t.category || "Sem categoria";
        catMap.set(key, (catMap.get(key) || 0) + amt);
      } else if (t.status === "Pendente") {
        projectedOut += amt;
        if (t.payment_date >= TODAY) pendingOutRemaining += amt;
      }
    }

    const leftover = totalBalance - pendingOutRemaining;

    const topCategories = Array.from(catMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    setState({
      loading: false,
      totalBalance,
      spentYear,
      projectedYearOut: projectedOut,
      leftover,
      topCategories,
    });
  }, [effectiveUserId, contextKey, applyCtx]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { ...state, refetch: fetchAll };
}

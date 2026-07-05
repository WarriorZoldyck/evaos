import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useRecurringTransactions, type RecurringOccurrence } from "@/hooks/useRecurringTransactions";
import { itemGross } from "@/lib/paymentKind";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  subYears,
  format,
  differenceInDays,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodKey = "today" | "week" | "month" | "year" | "custom";
export type ProjectionDays = 30 | 60 | 90 | 365;

export interface DashboardFilters {
  period: PeriodKey;
  customStart?: Date;
  customEnd?: Date;
  accountId?: string | null;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  status: "Pendente" | "Pago";
  payment_date: string;
  competence_date: string;
  category: string;
  subcategory: string | null;
  bank_account_id: string | null;
  credit_card_id: string | null;
  wallet_id: string | null;
  company_id: string | null;
  contact_name: string | null;
  series_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
  original_amount: number | null;
  card_terminal_id?: string | null;
  payment_method?: string | null;
}

export interface CreditCardInfo {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  last_four_digits: string | null;
  bank_account_id: string;
}

export interface CategorySummary {
  name: string;
  id: string;
  value: number;
  fill: string;
}

export interface ProjectionPoint {
  date: string;
  saldo: number;
  fullDate?: string;
}

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
  dre_section?: string | null;
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 90%, 50%)",
  "hsl(340, 82%, 52%)",
  "hsl(160, 60%, 45%)",
];

export function getDateRangeExported(filters: DashboardFilters): { start: Date; end: Date } {
  return getDateRange(filters);
}

function getDateRange(filters: DashboardFilters): { start: Date; end: Date } {
  const now = new Date();
  switch (filters.period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return {
        start: startOfWeek(now, { locale: ptBR }),
        end: endOfWeek(now, { locale: ptBR }),
      };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: filters.customStart ? startOfDay(filters.customStart) : startOfMonth(now),
        end: filters.customEnd ? endOfDay(filters.customEnd) : endOfMonth(now),
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

// Helper to apply account filter including linked credit cards
function applyAccountFilter(
  query: any,
  accountId: string | null | undefined,
  linkedCardIds: string[]
) {
  if (!accountId) return query;
  if (linkedCardIds.length > 0) {
    return query.or(
      `bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(",")})`
    );
  }
  return query.eq("bank_account_id", accountId);
}

import { applyCompanyFilter } from "@/lib/companyFilter";

export function useDashboardData(filters: DashboardFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected } = useCompany();
  const { occurrences: recurringOccurrences, loading: recurringLoading, refetch: refetchRecurring } = useRecurringTransactions(90);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [competenceTransactions, setCompetenceTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardInfo[]>([]);
  const [initialBalances, setInitialBalances] = useState<number>(0);
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [internalTransfersTotal, setInternalTransfersTotal] = useState(0);


  const { start, end } = getDateRange(filters);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const accountId = filters.accountId;

  // Derive linked card IDs from creditCards state
  const linkedCardIds = useMemo(() => {
    if (!accountId) return [];
    return creditCards.filter((c) => c.bank_account_id === accountId).map((c) => c.id);
  }, [accountId, creditCards]);

  // Refetch function exposed to consumers
  const refetch = useCallback(() => {
    setFetchTrigger((k) => k + 1);
    refetchRecurring();
  }, [refetchRecurring]);

  // Fetch credit cards + categories + initial balances
  useEffect(() => {
    if (!user) return;

    const companyCtx = { viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected };

    const fetchCards = async () => {
      let query = supabase
        .from("credit_cards")
        .select("id, name, closing_day, due_day, last_four_digits, bank_account_id");
      query = applyCompanyFilter(query, companyCtx);
      const { data } = await query;
      if (data) setCreditCards(data);
    };

    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name, parent_id, dre_section");
      if (data) setCategoryRecords(data);
    };

    const fetchBalances = async () => {
      // Bank accounts
      let bankQuery = supabase.from("bank_accounts").select("id, initial_balance");
      bankQuery = applyCompanyFilter(bankQuery, companyCtx);
      if (accountId) {
        bankQuery = bankQuery.eq("id", accountId);
      }
      const { data: bankData } = await bankQuery;

      // Wallets
      let walletQuery = supabase.from("wallets").select("id, initial_balance");
      walletQuery = applyCompanyFilter(walletQuery, companyCtx);
      const { data: walletData } = await walletQuery;

      const bankSum = bankData?.reduce((s, a) => s + Number(a.initial_balance), 0) || 0;
      const walletSum = accountId ? 0 : (walletData?.reduce((s, w) => s + Number(w.initial_balance), 0) || 0);
      setInitialBalances(bankSum + walletSum);

      // Calculate saldo atual (initial + all paid transactions)
      const bankIds = bankData?.map(b => b.id) || [];
      const walletIds = accountId ? [] : (walletData?.map(w => w.id) || []);

      let totalPaidDelta = 0;

      if (bankIds.length > 0) {
        const orParts: string[] = [];
        orParts.push(`bank_account_id.in.(${bankIds.join(",")})`);
        if (walletIds.length > 0) {
          orParts.push(`wallet_id.in.(${walletIds.join(",")})`);
        }
        
        let txQuery = supabase
          .from("transactions")
          .select("type, amount")
          .eq("status", "Pago")
          .or(orParts.join(","));

        const { data: txData } = await txQuery;
        if (txData) {
          totalPaidDelta = txData.reduce((acc, t) => acc + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);
        }
      } else if (walletIds.length > 0) {
        let txQuery = supabase
          .from("transactions")
          .select("type, amount")
          .eq("status", "Pago")
          .in("wallet_id", walletIds);

        const { data: txData } = await txQuery;
        if (txData) {
          totalPaidDelta = txData.reduce((acc, t) => acc + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);
        }
      }

      setSaldoAtual(bankSum + walletSum + totalPaidDelta);
    };

    fetchCards();
    fetchCategories();
    fetchBalances();
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, accountId, fetchTrigger]);

  // Fetch filtered transactions for the period
  useEffect(() => {
    if (!user) return;
    const companyCtx = { viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected };

    const fetchTransactions = async () => {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name, series_id, installment_number, installments_total, original_amount, card_terminal_id, payment_method")
        .gte("payment_date", startStr)
        .lte("payment_date", endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false")
        .not("category", "ilike", "transfer%")
        .not("category", "ilike", "transferência%");

      query = applyCompanyFilter(query, companyCtx);
      query = applyAccountFilter(query, accountId, linkedCardIds);

      const allData: Transaction[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await query.order("payment_date", { ascending: true }).range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...(data as Transaction[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setTransactions(allData);
      setLoading(false);
    };

    const fetchCompetenceTransactions = async () => {
      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name, series_id, installment_number, installments_total, original_amount, card_terminal_id, payment_method")
        .gte("competence_date", startStr)
        .lte("competence_date", endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false")
        .not("category", "ilike", "transfer%")
        .not("category", "ilike", "transferência%");

      query = applyCompanyFilter(query, companyCtx);
      query = applyAccountFilter(query, accountId, linkedCardIds);

      const allData: Transaction[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...(data as Transaction[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setCompetenceTransactions(allData);
    };

    const fetchInternalTransfersTotal = async () => {
      // Sum of internal transfers (one side only — receita) excluded from dashboard,
      // used to display a transparent badge to the user.
      let query = supabase
        .from("transactions")
        .select("amount, type", { count: "exact" })
        .gte("payment_date", startStr)
        .lte("payment_date", endStr)
        .eq("status", "Pago")
        .eq("is_internal_transfer", true)
        .eq("type", "receita");

      query = applyCompanyFilter(query, companyCtx);
      query = applyAccountFilter(query, accountId, linkedCardIds);

      const { data, error } = await query;
      if (!error && data) {
        const total = (data as { amount: number }[]).reduce(
          (acc, t) => acc + Number(t.amount || 0),
          0,
        );
        setInternalTransfersTotal(total);
      } else {
        setInternalTransfersTotal(0);
      }
    };

    fetchTransactions();
    fetchCompetenceTransactions();
    fetchInternalTransfersTotal();
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, startStr, endStr, accountId, linkedCardIds, fetchTrigger]);


  // Fetch transactions for projections (limited to 2 years back)
  useEffect(() => {
    if (!user) return;
    const companyCtx = { viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected };

    const fetchAll = async () => {
      const twoYearsAgo = format(subYears(new Date(), 2), "yyyy-MM-dd");
      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name")
        .gte("payment_date", twoYearsAgo)
        .or("transfer_id.is.null,is_internal_transfer.eq.false")
        .order("payment_date", { ascending: true })
        .limit(5000);

      query = applyCompanyFilter(query, companyCtx);
      query = applyAccountFilter(query, accountId, linkedCardIds);

      const { data, error } = await query;

      if (!error && data) {
        setAllTransactions(data as Transaction[]);
      }
    };

    fetchAll();
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, accountId, linkedCardIds, fetchTrigger]);

  // Category name resolver
  const resolveCategoryName = useCallback(
    (categoryValue: string): { name: string; id: string } => {
      // Try to find by ID first (UUID format)
      const byId = categoryRecords.find((c) => c.id === categoryValue);
      if (byId) return { name: byId.name, id: byId.id };
      // Try by name (legacy data)
      const byName = categoryRecords.find((c) => c.name === categoryValue && !c.parent_id);
      if (byName) return { name: byName.name, id: byName.id };
      // Fallback
      return { name: categoryValue, id: categoryValue };
    },
    [categoryRecords]
  );

  // Summary calculations
  const summary = useMemo(() => {
    const paidTransactions = transactions.filter((t) => t.status === "Pago");
    const entradas = paidTransactions
      .filter((t) => t.type === "receita")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const saidas = paidTransactions
      .filter((t) => t.type === "despesa")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // Faturamento Bruto: TODAS as receitas por competência (bate com DRE Gerencial)
    // Para vendas em cartão, amount é a fatia líquida (após MDR) e original_amount é o bruto.
    const receitasCompetencia = competenceTransactions.filter((t) => t.type === "receita");
    const faturamento = receitasCompetencia.reduce((acc, t) => acc + itemGross(t as any), 0);

    // Receita Operacional: só receitas cuja categoria (ou ancestral) tem dre_section mapeado
    // — bate com "(+) Receita Operacional Bruta" do DRE Contábil.
    const catById = new Map(categoryRecords.map((c) => [c.id, c]));
    const catByName = new Map<string, CategoryRecord>();
    categoryRecords.forEach((c) => {
      const key = c.name.toLowerCase();
      if (!catByName.has(key)) catByName.set(key, c);
    });
    const resolveCat = (ref: string | null | undefined): CategoryRecord | null => {
      if (!ref) return null;
      return catById.get(ref) ?? catByName.get(ref.toLowerCase()) ?? null;
    };
    const hasDreSection = (cat: CategoryRecord | null): boolean => {
      let current: CategoryRecord | null | undefined = cat;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        if (current.dre_section && current.dre_section.trim() !== "") return true;
        seen.add(current.id);
        current = current.parent_id ? catById.get(current.parent_id) ?? null : null;
      }
      return false;
    };
    let receitaOperacional = 0;
    const unmappedCategoryIds = new Set<string>();
    receitasCompetencia.forEach((t) => {
      const cat = resolveCat((t as any).subcategory) ?? resolveCat(t.category);
      const gross = itemGross(t as any);
      if (hasDreSection(cat)) {
        receitaOperacional += gross;
      } else {
        unmappedCategoryIds.add(cat?.id ?? t.category ?? "—");
      }
    });
    const unmappedRevenueCount = unmappedCategoryIds.size;
    const faturamentoNaoMapeado = faturamento - receitaOperacional;

    const saldo = entradas - saidas;

    // Entrada Prevista = receitas pendentes no período (por payment_date)
    const entradaPrevista = transactions
      .filter((t) => t.type === "receita" && t.status === "Pendente")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // Saída Prevista = despesas pendentes no período (por payment_date)
    const saidaPrevista = transactions
      .filter((t) => t.type === "despesa" && t.status === "Pendente")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // MDR: taxas de maquininha
    const mdrTransactions = paidTransactions.filter(
      (t) => t.original_amount && Number(t.original_amount) > 0
    );
    const mdrBruto = mdrTransactions.reduce((acc, t) => acc + Number(t.original_amount!), 0);
    const mdrLiquido = mdrTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const mdrTaxas = mdrBruto - mdrLiquido;
    const mdrPercent = mdrBruto > 0 ? (mdrTaxas / mdrBruto) * 100 : 0;
    const mdrCount = mdrTransactions.length;

    return {
      faturamento, receitaOperacional, faturamentoNaoMapeado, unmappedRevenueCount,
      entradas, saidas, saldo, entradaPrevista, saidaPrevista,
      mdrBruto, mdrLiquido, mdrTaxas, mdrPercent, mdrCount,
    };

  }, [transactions, competenceTransactions, categoryRecords]);

  // Upcoming (Pendente) transactions
  const upcomingTransactions = useMemo(() => {
    const pending = transactions
      .filter((t) => t.status === "Pendente")
      .map((t) => ({ ...t, isRecurring: false as const }));

    // Filter recurring occurrences within period
    const recurringInPeriod = recurringOccurrences
      .filter((r) => r.payment_date >= startStr && r.payment_date <= endStr)
      .map((r) => ({ ...r }));

    const combined = [...pending, ...recurringInPeriod];
    return combined
      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
      .slice(0, 20)
      .map((t) => ({
        ...t,
        category: resolveCategoryName(t.category).name,
      }));
  }, [transactions, recurringOccurrences, startStr, endStr, resolveCategoryName]);

  // Category summary for doughnut charts - resolves UUID to name
  const categoryBreakdown = useMemo(() => {
    const paidInPeriod = transactions.filter((t) => t.status === "Pago");

    const revenueByCategory = new Map<string, { name: string; id: string; value: number }>();
    const expenseByCategory = new Map<string, { name: string; id: string; value: number }>();

    paidInPeriod.forEach((t) => {
      const map = t.type === "receita" ? revenueByCategory : expenseByCategory;
      const resolved = resolveCategoryName(t.category);
      const key = resolved.id;
      const current = map.get(key);
      if (current) {
        current.value += Number(t.amount);
      } else {
        map.set(key, { name: resolved.name, id: resolved.id, value: Number(t.amount) });
      }
    });

    const revenueCategories: CategorySummary[] = Array.from(revenueByCategory.values()).map(
      (entry, i) => ({
        name: entry.name,
        id: entry.id,
        value: entry.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })
    );

    const expenseCategories: CategorySummary[] = Array.from(expenseByCategory.values()).map(
      (entry, i) => ({
        name: entry.name,
        id: entry.id,
        value: entry.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })
    );

    return { revenueCategories, expenseCategories };
  }, [transactions, resolveCategoryName]);

  // Balance projection - includes initial balances
  const getProjectionData = useMemo(() => {
    return (days: ProjectionDays): ProjectionPoint[] => {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");

      // Correção B: Only count paid transactions with payment_date <= today in base balance
      const paidBefore = allTransactions.filter(
        (t) => t.status === "Pago" && t.payment_date <= todayStr
      );

      let currentBalance = initialBalances + paidBefore.reduce((acc, t) => {
        return acc + (t.type === "receita" ? Number(t.amount) : -Number(t.amount));
      }, 0);

      // "Ano todo" → até 31/12 do ano corrente
      const futureEnd = days === 365 ? endOfYear(today) : addDays(today, days);
      const futureEndStr = format(futureEnd, "yyyy-MM-dd");
      const dateRange = eachDayOfInterval({ start: today, end: futureEnd });

      // Future transactions: all with payment_date > today (both Pago and Pendente)
      const futureTransactions = allTransactions.filter(
        (t) => t.payment_date > todayStr && t.payment_date <= futureEndStr
      );

      const futureByDate = new Map<string, number>();
      futureTransactions.forEach((t) => {
        const dateKey = t.payment_date;
        const current = futureByDate.get(dateKey) || 0;
        const amount = t.type === "receita" ? Number(t.amount) : -Number(t.amount);
        futureByDate.set(dateKey, current + amount);
      });

      // Correção A: Build dedup set from real future transactions to avoid double-counting recurring
      const realTransactionKeys = new Set<string>();
      futureTransactions.forEach((t) => {
        realTransactionKeys.add(`${t.payment_date}_${Number(t.amount)}_${t.description}`);
      });

      // Add recurring occurrences, skipping duplicates
      recurringOccurrences.forEach((r) => {
        if (r.payment_date > todayStr && r.payment_date <= futureEndStr) {
          const dedupKey = `${r.payment_date}_${Number(r.amount)}_${r.description}`;
          if (realTransactionKeys.has(dedupKey)) return; // already counted as real transaction

          // Correção C: When filtering by account, skip recurring that don't belong
          if (accountId && r.bank_account_id !== accountId && !linkedCardIds.includes(r.credit_card_id || "")) {
            return;
          }

          const dateKey = r.payment_date;
          const current = futureByDate.get(dateKey) || 0;
          const amount = r.type === "receita" ? Number(r.amount) : -Number(r.amount);
          futureByDate.set(dateKey, current + amount);
        }
      });

      const points: ProjectionPoint[] = [];
      let runningBalance = currentBalance;

      dateRange.forEach((date) => {
        const dateKey = format(date, "yyyy-MM-dd");
        const dayAmount = futureByDate.get(dateKey) || 0;
        runningBalance += dayAmount;
        points.push({
          date: format(date, "dd/MM", { locale: ptBR }),
          saldo: runningBalance,
          fullDate: dateKey,
        });
      });

      return points;
    };
  }, [allTransactions, recurringOccurrences, initialBalances, accountId, linkedCardIds]);

  // Performance: average daily spending
  const performance = useMemo(() => {
    const paidExpenses = transactions.filter(
      (t) => t.type === "despesa" && t.status === "Pago"
    );
    const totalExpenses = paidExpenses.reduce((acc, t) => acc + Number(t.amount), 0);
    const daysInPeriod = Math.max(differenceInDays(end, start), 1);
    const avgDailySpending = totalExpenses / daysInPeriod;

    return { avgDailySpending, totalExpenses, daysInPeriod };
  }, [transactions, start, end]);

  return {
    transactions,
    competenceTransactions,
    allTransactions,
    summary,
    saldoAtual,
    upcomingTransactions,
    categoryBreakdown,
    categoryRecords,
    getProjectionData,
    performance,
    creditCards,
    internalTransfersTotal,
    dateRange: { start, end },
    loading: loading || recurringLoading,
    refetch,
  };
}



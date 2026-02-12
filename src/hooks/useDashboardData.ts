import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useRecurringTransactions, type RecurringOccurrence } from "@/hooks/useRecurringTransactions";
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
}

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
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

export function useDashboardData(filters: DashboardFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { occurrences: recurringOccurrences, loading: recurringLoading, refetch: refetchRecurring } = useRecurringTransactions(90);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [competenceTransactions, setCompetenceTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardInfo[]>([]);
  const [initialBalances, setInitialBalances] = useState<number>(0);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);

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

    const fetchCards = async () => {
      let query = supabase
        .from("credit_cards")
        .select("id, name, closing_day, due_day, last_four_digits, bank_account_id");
      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }
      const { data } = await query;
      if (data) setCreditCards(data);
    };

    const fetchCategories = async () => {
      let query = supabase.from("categories").select("id, name, parent_id");
      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }
      const { data } = await query;
      if (data) setCategoryRecords(data);
    };

    const fetchBalances = async () => {
      // Bank accounts
      let bankQuery = supabase.from("bank_accounts").select("initial_balance");
      if (isPersonal) {
        bankQuery = bankQuery.is("company_id", null);
      } else if (selectedCompanyId) {
        bankQuery = bankQuery.eq("company_id", selectedCompanyId);
      }
      if (accountId) {
        bankQuery = bankQuery.eq("id", accountId);
      }
      const { data: bankData } = await bankQuery;

      // Wallets
      let walletQuery = supabase.from("wallets").select("initial_balance");
      if (isPersonal) {
        walletQuery = walletQuery.is("company_id", null);
      } else if (selectedCompanyId) {
        walletQuery = walletQuery.eq("company_id", selectedCompanyId);
      }
      const { data: walletData } = await walletQuery;

      const bankSum = bankData?.reduce((s, a) => s + Number(a.initial_balance), 0) || 0;
      const walletSum = accountId ? 0 : (walletData?.reduce((s, w) => s + Number(w.initial_balance), 0) || 0);
      setInitialBalances(bankSum + walletSum);
    };

    fetchCards();
    fetchCategories();
    fetchBalances();
  }, [user, selectedCompanyId, isPersonal, accountId, fetchTrigger]);

  // Fetch filtered transactions for the period
  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name, series_id, installment_number, installments_total, original_amount")
        .gte("payment_date", startStr)
        .lte("payment_date", endStr);

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      query = applyAccountFilter(query, accountId, linkedCardIds);

      const { data, error } = await query.order("payment_date", { ascending: true });

      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
      setLoading(false);
    };

    const fetchCompetenceTransactions = async () => {
      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name, series_id, installment_number, installments_total, original_amount")
        .gte("competence_date", startStr)
        .lte("competence_date", endStr);

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      query = applyAccountFilter(query, accountId, linkedCardIds);

      const { data, error } = await query;

      if (!error && data) {
        setCompetenceTransactions(data as Transaction[]);
      }
    };

    fetchTransactions();
    fetchCompetenceTransactions();
  }, [user, selectedCompanyId, isPersonal, startStr, endStr, accountId, linkedCardIds, fetchTrigger]);

  // Fetch transactions for projections (limited to 2 years back)
  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const twoYearsAgo = format(subYears(new Date(), 2), "yyyy-MM-dd");
      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name")
        .gte("payment_date", twoYearsAgo)
        .order("payment_date", { ascending: true })
        .limit(5000);

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      query = applyAccountFilter(query, accountId, linkedCardIds);

      const { data, error } = await query;

      if (!error && data) {
        setAllTransactions(data as Transaction[]);
      }
    };

    fetchAll();
  }, [user, selectedCompanyId, isPersonal, accountId, linkedCardIds, fetchTrigger]);

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

    // Faturamento: valor bruto total das vendas por competência no período
    const faturamento = competenceTransactions
      .filter((t) => t.type === "receita")
      .reduce((acc, t) => {
        if (!t.series_id) return acc + Number(t.amount);
        if (t.installment_number === 1) {
          const totalValue = t.original_amount
            ? Number(t.original_amount)
            : Number(t.amount) * (t.installments_total || 1);
          return acc + totalValue;
        }
        return acc;
      }, 0);

    const saldo = entradas - saidas;

    // FIX #4: Both previsto and consolidado from competenceTransactions (same base)
    const previstoReceitas = competenceTransactions
      .filter((t) => t.type === "receita")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const consolidadoReceitas = competenceTransactions
      .filter((t) => t.type === "receita" && t.status === "Pago")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // Entrada Prevista = o que falta receber (previsto - já pago na mesma base)
    const entradaPrevista = Math.max(previstoReceitas - consolidadoReceitas, 0);

    return { faturamento, entradas, saidas, saldo, entradaPrevista };
  }, [transactions, competenceTransactions]);

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
      .slice(0, 20);
  }, [transactions, recurringOccurrences, startStr, endStr]);

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
      const paidBefore = allTransactions.filter(
        (t) => t.status === "Pago" && new Date(t.payment_date) <= today
      );

      // FIX #10: Include initial balances of bank accounts + wallets
      let currentBalance = initialBalances + paidBefore.reduce((acc, t) => {
        return acc + (t.type === "receita" ? Number(t.amount) : -Number(t.amount));
      }, 0);

      // "Ano todo" → até 31/12 do ano corrente
      const futureEnd = days === 365 ? endOfYear(today) : addDays(today, days);
      const dateRange = eachDayOfInterval({ start: today, end: futureEnd });

      // Combine future real transactions + recurring occurrences
      const futureTransactions = allTransactions.filter(
        (t) => new Date(t.payment_date) > today && new Date(t.payment_date) <= futureEnd
      );

      const futureByDate = new Map<string, number>();
      futureTransactions.forEach((t) => {
        const dateKey = t.payment_date;
        const current = futureByDate.get(dateKey) || 0;
        const amount = t.type === "receita" ? Number(t.amount) : -Number(t.amount);
        futureByDate.set(dateKey, current + amount);
      });

      // Add recurring occurrences to projection
      recurringOccurrences.forEach((r) => {
        const rDate = new Date(r.payment_date + "T00:00:00");
        if (rDate > today && rDate <= futureEnd) {
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
        });
      });

      return points;
    };
  }, [allTransactions, recurringOccurrences, initialBalances]);

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
    summary,
    upcomingTransactions,
    categoryBreakdown,
    getProjectionData,
    performance,
    creditCards,
    loading: loading || recurringLoading,
    refetch,
  };
}

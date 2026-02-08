import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
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
  format,
  differenceInDays,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodKey = "today" | "week" | "month" | "year" | "custom";
export type ProjectionDays = 30 | 60 | 90;

export interface DashboardFilters {
  period: PeriodKey;
  customStart?: Date;
  customEnd?: Date;
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
}

export interface CategorySummary {
  name: string;
  value: number;
  fill: string;
}

export interface ProjectionPoint {
  date: string;
  saldo: number;
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

export function useDashboardData(filters: DashboardFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end } = getDateRange(filters);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Fetch filtered transactions for the period
  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name")
        .gte("payment_date", startStr)
        .lte("payment_date", endStr);

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query.order("payment_date", { ascending: true });

      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
      setLoading(false);
    };

    fetchTransactions();
  }, [user, selectedCompanyId, isPersonal, startStr, endStr]);

  // Fetch all transactions for projections (no date filter)
  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, status, payment_date, competence_date, category, subcategory, bank_account_id, credit_card_id, wallet_id, company_id, contact_name");

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query.order("payment_date", { ascending: true });

      if (!error && data) {
        setAllTransactions(data as Transaction[]);
      }
    };

    fetchAll();
  }, [user, selectedCompanyId, isPersonal]);

  // Summary calculations
  const summary = useMemo(() => {
    const paidTransactions = transactions.filter((t) => t.status === "Pago");
    const entradas = paidTransactions
      .filter((t) => t.type === "receita")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const saidas = paidTransactions
      .filter((t) => t.type === "despesa")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const faturamento = entradas;
    const saldo = entradas - saidas;

    return { faturamento, entradas, saidas, saldo };
  }, [transactions]);

  // Upcoming (Pendente) transactions
  const upcomingTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.status === "Pendente")
      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
      .slice(0, 10);
  }, [transactions]);

  // Category summary for doughnut charts
  const categoryBreakdown = useMemo(() => {
    const paidInPeriod = transactions.filter((t) => t.status === "Pago");

    const revenueByCategory = new Map<string, number>();
    const expenseByCategory = new Map<string, number>();

    paidInPeriod.forEach((t) => {
      const map = t.type === "receita" ? revenueByCategory : expenseByCategory;
      const current = map.get(t.category) || 0;
      map.set(t.category, current + Number(t.amount));
    });

    const revenueCategories: CategorySummary[] = Array.from(revenueByCategory.entries()).map(
      ([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })
    );

    const expenseCategories: CategorySummary[] = Array.from(expenseByCategory.entries()).map(
      ([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })
    );

    return { revenueCategories, expenseCategories };
  }, [transactions]);

  // Balance projection
  const getProjectionData = useMemo(() => {
    return (days: ProjectionDays): ProjectionPoint[] => {
      const today = new Date();
      const paidBefore = allTransactions.filter(
        (t) => t.status === "Pago" && new Date(t.payment_date) <= today
      );

      let currentBalance = paidBefore.reduce((acc, t) => {
        return acc + (t.type === "receita" ? Number(t.amount) : -Number(t.amount));
      }, 0);

      const futureEnd = addDays(today, days);
      const dateRange = eachDayOfInterval({ start: today, end: futureEnd });

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
  }, [allTransactions]);

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
    loading,
  };
}

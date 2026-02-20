import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { addMonths, addDays, format, startOfDay } from "date-fns";

export interface RecurringOccurrence {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  status: "Pendente";
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
  payment_method: string | null;
  isRecurring: true;
}

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  category: string;
  subcategory: string | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  day_of_month: number | null;
  bank_account_id: string | null;
  credit_card_id: string | null;
  wallet_id: string | null;
  company_id: string | null;
  contact_name: string | null;
  series_id: string | null;
  payment_method: string | null;
  payment_date: string | null;
}

function generateOccurrences(
  rec: RecurringTransaction,
  horizonDays: number = 90
): RecurringOccurrence[] {
  const today = startOfDay(new Date());
  const horizon = addDays(today, horizonDays);
  const endLimit = rec.end_date ? new Date(rec.end_date + "T00:00:00") : horizon;
  const finalEnd = endLimit < horizon ? endLimit : horizon;

  const startDate = new Date(rec.start_date + "T00:00:00");
  const occurrences: RecurringOccurrence[] = [];

  let current = startDate < today ? new Date(today) : new Date(startDate);

  // For monthly, align to day_of_month if available
  if (rec.frequency === "monthly" && rec.day_of_month) {
    const dayTarget = rec.day_of_month;
    // Start from the month of `current`, set day
    current.setDate(1); // avoid overflow
    if (current < startDate) current = new Date(startDate);
    
    // Find the first occurrence >= current with the right day
    let candidate = new Date(current.getFullYear(), current.getMonth(), Math.min(dayTarget, new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()));
    if (candidate < current) {
      candidate = addMonths(candidate, 1);
      const daysInMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      candidate.setDate(Math.min(dayTarget, daysInMonth));
    }
    current = candidate;
  }

  const maxIterations = 500; // safety
  let i = 0;

  while (current <= finalEnd && i < maxIterations) {
    i++;
    const dateStr = format(current, "yyyy-MM-dd");

    occurrences.push({
      id: `rec_${rec.id}_${dateStr}`,
      description: rec.description,
      amount: rec.amount,
      type: rec.type,
      status: "Pendente",
      payment_date: dateStr,
      competence_date: dateStr,
      category: rec.category,
      subcategory: rec.subcategory,
      bank_account_id: rec.bank_account_id,
      credit_card_id: rec.credit_card_id,
      wallet_id: rec.wallet_id,
      company_id: rec.company_id,
      contact_name: rec.contact_name,
      series_id: rec.series_id,
      payment_method: rec.payment_method,
      isRecurring: true,
    });

    if (rec.frequency === "monthly") {
      current = addMonths(current, 1);
      if (rec.day_of_month) {
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(rec.day_of_month, daysInMonth));
      }
    } else if (rec.frequency === "daily") {
      current = addDays(current, 1);
    } else if (rec.frequency === "weekly") {
      current = addDays(current, 7);
    } else if (rec.frequency === "biweekly") {
      current = addDays(current, 14);
    } else if (rec.frequency === "custom_days") {
      current = addDays(current, rec.day_of_month || 1);
    } else if (rec.frequency === "yearly") {
      current = addMonths(current, 12);
    } else {
      break;
    }
  }

  return occurrences;
}

export function useRecurringTransactions(horizonDays: number = 90) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurring = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("recurring_transactions")
      .select("id, description, amount, type, category, subcategory, frequency, start_date, end_date, day_of_month, bank_account_id, credit_card_id, wallet_id, company_id, contact_name, series_id, payment_method, payment_date");

    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const all: RecurringOccurrence[] = [];
      (data as RecurringTransaction[]).forEach((rec) => {
        all.push(...generateOccurrences(rec, horizonDays));
      });
      setOccurrences(all);
    }
    setLoading(false);
  }, [user, selectedCompanyId, isPersonal, horizonDays]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  return { occurrences, loading, refetch: fetchRecurring };
}

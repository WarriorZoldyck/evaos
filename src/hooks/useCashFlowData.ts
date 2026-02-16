import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import { getDateRangeExported } from "@/hooks/useDashboardData";

export type CashFlowMode = "caixa" | "competencia";

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  total: number;
  children: { categoryId: string; name: string; total: number }[];
}

export function useCashFlowData(mode: CashFlowMode, filters: DashboardFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [creditCards, setCreditCards] = useState<{ id: string; bank_account_id: string }[]>([]);

  const { start, end } = getDateRangeExported(filters);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const accountId = filters.accountId;

  // Linked card IDs for account filter
  const linkedCardIds = useMemo(() => {
    if (!accountId) return [];
    return creditCards.filter((c) => c.bank_account_id === accountId).map((c) => c.id);
  }, [accountId, creditCards]);

  // Fetch categories and credit cards
  useEffect(() => {
    if (!user) return;

    const fetchCategories = async () => {
      let query = supabase.from("categories").select("id, name, parent_id");
      if (isPersonal) query = query.is("company_id", null);
      else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      if (data) setCategories(data);
    };

    const fetchCards = async () => {
      let query = supabase.from("credit_cards").select("id, bank_account_id");
      if (isPersonal) query = query.is("company_id", null);
      else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      if (data) setCreditCards(data);
    };

    fetchCategories();
    fetchCards();
  }, [user, selectedCompanyId, isPersonal]);

  // Fetch transactions
  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      setLoading(true);
      const dateField = mode === "caixa" ? "payment_date" : "competence_date";

      let query = supabase
        .from("transactions")
        .select("id, amount, type, status, category, subcategory, bank_account_id, credit_card_id")
        .gte(dateField, startStr)
        .lte(dateField, endStr);

      if (mode === "caixa") {
        query = query.eq("status", "Pago");
      }

      if (isPersonal) query = query.is("company_id", null);
      else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);

      // Account filter
      if (accountId) {
        if (linkedCardIds.length > 0) {
          query = query.or(
            `bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(",")})`
          );
        } else {
          query = query.eq("bank_account_id", accountId);
        }
      }

      const { data } = await query;
      setTransactions(data || []);
      setLoading(false);
    };

    fetch();
  }, [user, selectedCompanyId, isPersonal, startStr, endStr, accountId, linkedCardIds, mode]);

  // Resolve category: find root parent
  const resolveToRoot = useCallback(
    (categoryValue: string): { rootId: string; rootName: string; childId: string | null; childName: string | null } => {
      // Find by ID
      let cat = categories.find((c) => c.id === categoryValue);
      // Fallback: find by name
      if (!cat) cat = categories.find((c) => c.name === categoryValue);
      if (!cat) return { rootId: categoryValue, rootName: categoryValue, childId: null, childName: null };

      // Walk up to root
      let current = cat;
      let child: CategoryRecord | null = null;
      while (current.parent_id) {
        child = current;
        const parent = categories.find((c) => c.id === current.parent_id);
        if (!parent) break;
        current = parent;
      }

      // If the category IS the root, check if the original category is a child
      if (current.id === cat.id) {
        return { rootId: current.id, rootName: current.name, childId: null, childName: null };
      }

      return {
        rootId: current.id,
        rootName: current.name,
        childId: cat.id,
        childName: cat.name,
      };
    },
    [categories]
  );

  // Build grouped data
  const { revenueGroups, expenseGroups, totalRevenue, totalExpense } = useMemo(() => {
    const revenueMap = new Map<string, { name: string; total: number; children: Map<string, { name: string; total: number }> }>();
    const expenseMap = new Map<string, { name: string; total: number; children: Map<string, { name: string; total: number }> }>();

    transactions.forEach((t) => {
      const map = t.type === "receita" ? revenueMap : expenseMap;
      const amount = Number(t.amount);
      const resolved = resolveToRoot(t.category);

      let group = map.get(resolved.rootId);
      if (!group) {
        group = { name: resolved.rootName, total: 0, children: new Map() };
        map.set(resolved.rootId, group);
      }
      group.total += amount;

      if (resolved.childId && resolved.childName) {
        const child = group.children.get(resolved.childId);
        if (child) {
          child.total += amount;
        } else {
          group.children.set(resolved.childId, { name: resolved.childName, total: amount });
        }
      }
    });

    const toGroups = (m: typeof revenueMap): CategoryGroup[] =>
      Array.from(m.entries())
        .map(([id, g]) => ({
          categoryId: id,
          categoryName: g.name,
          total: g.total,
          children: Array.from(g.children.entries())
            .map(([cid, c]) => ({ categoryId: cid, name: c.name, total: c.total }))
            .sort((a, b) => b.total - a.total),
        }))
        .sort((a, b) => b.total - a.total);

    const rev = toGroups(revenueMap);
    const exp = toGroups(expenseMap);

    return {
      revenueGroups: rev,
      expenseGroups: exp,
      totalRevenue: rev.reduce((s, g) => s + g.total, 0),
      totalExpense: exp.reduce((s, g) => s + g.total, 0),
    };
  }, [transactions, resolveToRoot]);

  return {
    revenueGroups,
    expenseGroups,
    totalRevenue,
    totalExpense,
    result: totalRevenue - totalExpense,
    loading,
  };
}

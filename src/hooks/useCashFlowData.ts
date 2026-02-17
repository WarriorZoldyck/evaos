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
  children: CategoryGroup[];
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

  // Resolve category to its full ancestor chain [root, ..., leaf]
  const resolveChain = useCallback(
    (categoryValue: string): { id: string; name: string }[] => {
      let cat = categories.find((c) => c.id === categoryValue);
      if (!cat) cat = categories.find((c) => c.name === categoryValue);
      if (!cat) return [{ id: categoryValue, name: categoryValue }];

      // Build chain from leaf to root
      const chain: { id: string; name: string }[] = [];
      let current: CategoryRecord | undefined = cat;
      while (current) {
        chain.unshift({ id: current.id, name: current.name });
        current = current.parent_id
          ? categories.find((c) => c.id === current!.parent_id)
          : undefined;
      }
      return chain;
    },
    [categories]
  );

  // Build grouped data as recursive tree
  const { revenueGroups, expenseGroups, totalRevenue, totalExpense } = useMemo(() => {
    type TreeNode = { name: string; total: number; children: Map<string, TreeNode> };
    const revenueTree = new Map<string, TreeNode>();
    const expenseTree = new Map<string, TreeNode>();

    transactions.forEach((t) => {
      const tree = t.type === "receita" ? revenueTree : expenseTree;
      const amount = Number(t.amount);
      const chain = resolveChain(t.category);

      let currentLevel = tree;
      for (let i = 0; i < chain.length; i++) {
        const { id, name } = chain[i];
        let node = currentLevel.get(id);
        if (!node) {
          node = { name, total: 0, children: new Map() };
          currentLevel.set(id, node);
        }
        node.total += amount;
        currentLevel = node.children;
      }
    });

    const toGroups = (m: Map<string, TreeNode>): CategoryGroup[] =>
      Array.from(m.entries())
        .map(([id, node]) => ({
          categoryId: id,
          categoryName: node.name,
          total: node.total,
          children: toGroups(node.children),
        }))
        .sort((a, b) => b.total - a.total);

    const rev = toGroups(revenueTree);
    const exp = toGroups(expenseTree);

    return {
      revenueGroups: rev,
      expenseGroups: exp,
      totalRevenue: rev.reduce((s, g) => s + g.total, 0),
      totalExpense: exp.reduce((s, g) => s + g.total, 0),
    };
  }, [transactions, resolveChain]);

  return {
    revenueGroups,
    expenseGroups,
    totalRevenue,
    totalExpense,
    result: totalRevenue - totalExpense,
    loading,
  };
}

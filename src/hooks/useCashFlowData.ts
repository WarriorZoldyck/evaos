import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import { getDateRangeExported } from "@/hooks/useDashboardData";
import { applyCompanyFilter } from "@/lib/companyFilter";

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
  const { selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected } = useCompany();
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
      // Fetch ALL user categories (no company filter) to resolve cross-context references
      const { data } = await supabase.from("categories").select("id, name, parent_id");
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

  // Fetch transactions with pagination and transfer filter
  useEffect(() => {
    if (!user) return;

    const fetchTx = async () => {
      setLoading(true);
      const dateField = mode === "caixa" ? "payment_date" : "competence_date";

      let query = supabase
        .from("transactions")
        .select("id, amount, type, status, category, subcategory, subcategory2, bank_account_id, credit_card_id, transfer_id")
        .gte(dateField, startStr)
        .lte(dateField, endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false");

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

      // Paginate to avoid Supabase's default 1000 row limit
      const allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
      }

      setTransactions(allData);
      setLoading(false);
    };

    fetchTx();
  }, [user, selectedCompanyId, isPersonal, startStr, endStr, accountId, linkedCardIds, mode]);

  // Resolve a category name/id to its display name
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const resolveName = useCallback(
    (value: string | null | undefined): { id: string; name: string } | null => {
      if (!value) return null;
      let cat = categories.find((c) => c.id === value);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === value.toLowerCase());
      if (cat) return { id: cat.id, name: cat.name };
      // Don't display raw UUIDs — skip unresolved references
      if (isUuid(value)) return null;
      return { id: value, name: value };
    },
    [categories]
  );

  // Build 3-level category chain (same logic as DRE)
  const buildChain = useCallback(
    (category: string, subcategory?: string | null, subcategory2?: string | null): { id: string; name: string }[] => {
      const chain: { id: string; name: string }[] = [];

      let cat = categories.find((c) => c.id === category);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());

      if (cat && cat.parent_id) {
        const fullChain: { id: string; name: string }[] = [];
        let current: CategoryRecord | undefined = cat;
        while (current) {
          fullChain.unshift({ id: current.id, name: current.name });
          current = current.parent_id ? categories.find((c) => c.id === current!.parent_id) : undefined;
        }
        chain.push(...fullChain);
      } else {
        const resolved = resolveName(category);
        if (resolved) chain.push(resolved);
      }

      if (subcategory) {
        const sub = resolveName(subcategory);
        if (sub && !chain.some((c) => c.id === sub.id)) {
          chain.push(sub);
        }
      }

      if (subcategory2) {
        const sub2 = resolveName(subcategory2);
        if (sub2 && !chain.some((c) => c.id === sub2.id)) {
          chain.push(sub2);
        }
      }

      return chain.length > 0 ? chain : [{ id: category, name: category }];
    },
    [categories, resolveName]
  );

  // Build grouped data as recursive tree
  const { revenueGroups, expenseGroups, totalRevenue, totalExpense } = useMemo(() => {
    type TreeNode = { name: string; total: number; children: Map<string, TreeNode> };
    const revenueTree = new Map<string, TreeNode>();
    const expenseTree = new Map<string, TreeNode>();

    transactions.forEach((t) => {
      const tree = t.type === "receita" ? revenueTree : expenseTree;
      const amount = Number(t.amount);
      const chain = buildChain(t.category, t.subcategory, t.subcategory2);

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
  }, [transactions, buildChain]);

  return {
    revenueGroups,
    expenseGroups,
    totalRevenue,
    totalExpense,
    result: totalRevenue - totalExpense,
    loading,
  };
}

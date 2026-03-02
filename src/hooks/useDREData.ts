import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

export type DREGranularity = "monthly" | "quarterly" | "semiannual";

export interface DRECategoryRow {
  categoryId: string;
  categoryName: string;
  monthlyTotals: Record<string, number>;
  children: DRECategoryRow[];
}

export interface DREFilters {
  year: number;
  granularity: DREGranularity;
  accountId?: string | null;
}

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
}

/** Returns period keys based on granularity, e.g. ["2026-01","2026-02",...] or ["2026-Q1",...] */
function buildPeriodKeys(year: number, granularity: DREGranularity): string[] {
  if (granularity === "monthly") {
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }
  if (granularity === "quarterly") {
    return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  }
  return [`${year}-S1`, `${year}-S2`];
}

function getPeriodLabel(key: string): string {
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (key.includes("-Q")) return key.split("-")[1];
  if (key.includes("-S")) return key.split("-")[1] === "S1" ? "1º Sem" : "2º Sem";
  const month = parseInt(key.split("-")[1], 10);
  return monthNames[month - 1] || key;
}

function dateToPeriodKey(dateStr: string, granularity: DREGranularity): string {
  const [y, m] = dateStr.split("-").map(Number);
  if (granularity === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  if (granularity === "quarterly") return `${y}-Q${Math.ceil(m / 3)}`;
  return `${y}-S${m <= 6 ? 1 : 2}`;
}

export { getPeriodLabel };

export function useDREData(filters: DREFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [creditCards, setCreditCards] = useState<{ id: string; bank_account_id: string }[]>([]);

  const { year, granularity, accountId } = filters;
  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;

  const linkedCardIds = useMemo(() => {
    if (!accountId) return [];
    return creditCards.filter((c) => c.bank_account_id === accountId).map((c) => c.id);
  }, [accountId, creditCards]);

  // Fetch categories & cards
  useEffect(() => {
    if (!user) return;
    const fetchCats = async () => {
      // Fetch ALL user categories (RLS filters by user) to resolve names across companies
      const q = supabase.from("categories").select("id, name, parent_id");
      const { data } = await q;
      if (data) setCategories(data);
    };
    const fetchCards = async () => {
      let q = supabase.from("credit_cards").select("id, bank_account_id");
      if (isPersonal) q = q.is("company_id", null);
      else if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      const { data } = await q;
      if (data) setCreditCards(data);
    };
    fetchCats();
    fetchCards();
  }, [user, selectedCompanyId, isPersonal]);

  // Fetch transactions for the whole year
  useEffect(() => {
    if (!user) return;
    const fetchTx = async () => {
      setLoading(true);
      let q = supabase
        .from("transactions")
        .select("id, amount, type, category, subcategory, subcategory2, competence_date, bank_account_id, credit_card_id, transfer_id")
        .gte("competence_date", startStr)
        .lte("competence_date", endStr)
        .is("transfer_id", null);

      if (isPersonal) q = q.is("company_id", null);
      else if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);

      if (accountId) {
        if (linkedCardIds.length > 0) {
          q = q.or(`bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(",")})`);
        } else {
          q = q.eq("bank_account_id", accountId);
        }
      }

      // Paginate to avoid Supabase's default 1000 row limit
      const allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
      }

      setTransactions(allData);
      setLoading(false);
    };
    fetchTx();
  }, [user, selectedCompanyId, isPersonal, startStr, endStr, accountId, linkedCardIds]);

  const resolveName = useCallback(
    (value: string | null | undefined): { id: string; name: string } | null => {
      if (!value) return null;
      let cat = categories.find((c) => c.id === value);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === value.toLowerCase());
      if (cat) return { id: cat.id, name: cat.name };
      return { id: value, name: value };
    },
    [categories]
  );

  const buildChain = useCallback(
    (category: string, subcategory?: string | null, subcategory2?: string | null): { id: string; name: string }[] => {
      const chain: { id: string; name: string }[] = [];

      // Try to resolve category via parent chain first (if it's a leaf UUID, walk up)
      let cat = categories.find((c) => c.id === category);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());

      if (cat && cat.parent_id) {
        // This category has a parent, so resolve the full chain upward
        const fullChain: { id: string; name: string }[] = [];
        let current: CategoryRecord | undefined = cat;
        while (current) {
          fullChain.unshift({ id: current.id, name: current.name });
          current = current.parent_id ? categories.find((c) => c.id === current!.parent_id) : undefined;
        }
        // If we already have the full chain from the UUID, use it
        // and then append subcategory/subcategory2 if they add more depth
        chain.push(...fullChain);
      } else {
        // Root-level category or name-based
        const resolved = resolveName(category);
        if (resolved) chain.push(resolved);
      }

      // Add subcategory if it's a different level
      if (subcategory) {
        const sub = resolveName(subcategory);
        if (sub && !chain.some((c) => c.id === sub.id)) {
          chain.push(sub);
        }
      }

      // Add subcategory2 if it's a different level
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

  const periods = useMemo(() => buildPeriodKeys(year, granularity), [year, granularity]);

  const { revenueRows, expenseRows, monthlyRevenueTotals, monthlyExpenseTotals, monthlyResults } = useMemo(() => {
    type TreeNode = { name: string; totals: Record<string, number>; children: Map<string, TreeNode> };
    const revTree = new Map<string, TreeNode>();
    const expTree = new Map<string, TreeNode>();

    const emptyTotals = (): Record<string, number> => Object.fromEntries(periods.map((p) => [p, 0]));

    transactions.forEach((t) => {
      const tree = t.type === "receita" ? revTree : expTree;
      const amount = Number(t.amount);
      const pKey = dateToPeriodKey(t.competence_date, granularity);
      if (!periods.includes(pKey)) return;

      const chain = buildChain(t.category, t.subcategory, t.subcategory2);
      let currentLevel = tree;
      for (const { id, name } of chain) {
        let node = currentLevel.get(id);
        if (!node) {
          node = { name, totals: emptyTotals(), children: new Map() };
          currentLevel.set(id, node);
        }
        node.totals[pKey] = (node.totals[pKey] || 0) + amount;
        currentLevel = node.children;
      }
    });

    const toRows = (m: Map<string, TreeNode>): DRECategoryRow[] =>
      Array.from(m.entries())
        .map(([id, node]) => ({
          categoryId: id,
          categoryName: node.name,
          monthlyTotals: node.totals,
          children: toRows(node.children),
        }))
        .sort((a, b) => {
          const totalA = Object.values(a.monthlyTotals).reduce((s, v) => s + v, 0);
          const totalB = Object.values(b.monthlyTotals).reduce((s, v) => s + v, 0);
          return totalB - totalA;
        });

    const revRows = toRows(revTree);
    const expRows = toRows(expTree);

    const sumRow = (rows: DRECategoryRow[]): Record<string, number> => {
      const sums: Record<string, number> = Object.fromEntries(periods.map((p) => [p, 0]));
      rows.forEach((r) => periods.forEach((p) => (sums[p] += r.monthlyTotals[p] || 0)));
      return sums;
    };

    const mrt = sumRow(revRows);
    const met = sumRow(expRows);
    const mr: Record<string, number> = {};
    periods.forEach((p) => (mr[p] = mrt[p] - met[p]));

    return { revenueRows: revRows, expenseRows: expRows, monthlyRevenueTotals: mrt, monthlyExpenseTotals: met, monthlyResults: mr };
  }, [transactions, buildChain, periods, granularity]);

  return { periods, revenueRows, expenseRows, monthlyRevenueTotals, monthlyExpenseTotals, monthlyResults, loading };
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { applyCompanyFilter } from "@/lib/companyFilter";
import type { DRECategoryRow, DREGranularity } from "@/hooks/useDREData";

export type CashFlowMode = "caixa" | "competencia";

export interface CashFlowMonthlyFilters {
  year: number;
  granularity: DREGranularity;
  accountId?: string | null;
}

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
}

function buildPeriodKeys(year: number, granularity: DREGranularity): string[] {
  if (granularity === "monthly") {
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }
  if (granularity === "quarterly") {
    return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  }
  return [`${year}-S1`, `${year}-S2`];
}

function dateToPeriodKey(dateStr: string, granularity: DREGranularity): string {
  const [y, m] = dateStr.split("-").map(Number);
  if (granularity === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  if (granularity === "quarterly") return `${y}-Q${Math.ceil(m / 3)}`;
  return `${y}-S${m <= 6 ? 1 : 2}`;
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function useCashFlowMonthly(mode: CashFlowMode, filters: CashFlowMonthlyFilters) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected } = useCompany();
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

  useEffect(() => {
    if (!user) return;
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("id, name, parent_id");
      if (data) setCategories(data);
    };
    const fetchCards = async () => {
      let q = supabase.from("credit_cards").select("id, bank_account_id");
      q = applyCompanyFilter(q, { viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected });
      const { data } = await q;
      if (data) setCreditCards(data);
    };
    fetchCats();
    fetchCards();
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected]);

  useEffect(() => {
    if (!user) return;
    const fetchTx = async () => {
      setLoading(true);
      const dateField = mode === "caixa" ? "payment_date" : "competence_date";

      let q = supabase
        .from("transactions")
        .select(`id, amount, type, status, category, subcategory, subcategory2, ${dateField}, bank_account_id, credit_card_id, transfer_id`)
        .gte(dateField, startStr)
        .lte(dateField, endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false");

      if (mode === "caixa") q = q.eq("status", "Pago");

      q = applyCompanyFilter(q, { viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected });

      if (accountId) {
        if (linkedCardIds.length > 0) {
          q = q.or(`bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(",")})`);
        } else {
          q = q.eq("bank_account_id", accountId);
        }
      }

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
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, startStr, endStr, accountId, linkedCardIds, mode]);

  const resolveName = useCallback(
    (value: string | null | undefined): { id: string; name: string } | null => {
      if (!value) return null;
      let cat = categories.find((c) => c.id === value);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === value.toLowerCase());
      if (cat) return { id: cat.id, name: cat.name };
      if (isUuid(value)) return null;
      return { id: value, name: value };
    },
    [categories]
  );

  const buildChain = useCallback(
    (category: string, subcategory?: string | null, subcategory2?: string | null): { id: string; name: string }[] => {
      const chain: { id: string; name: string }[] = [];
      let cat = categories.find((c) => c.id === category);
      if (!cat) cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
      if (cat && cat.parent_id) {
        const full: { id: string; name: string }[] = [];
        let curr: CategoryRecord | undefined = cat;
        while (curr) {
          full.unshift({ id: curr.id, name: curr.name });
          curr = curr.parent_id ? categories.find((c) => c.id === curr!.parent_id) : undefined;
        }
        chain.push(...full);
      } else {
        const r = resolveName(category);
        if (r) chain.push(r);
      }
      if (subcategory) {
        const s = resolveName(subcategory);
        if (s && !chain.some((c) => c.id === s.id)) chain.push(s);
      }
      if (subcategory2) {
        const s2 = resolveName(subcategory2);
        if (s2 && !chain.some((c) => c.id === s2.id)) chain.push(s2);
      }
      return chain.length > 0 ? chain : [{ id: category, name: category }];
    },
    [categories, resolveName]
  );

  const periods = useMemo(() => buildPeriodKeys(year, granularity), [year, granularity]);

  const data = useMemo(() => {
    type TreeNode = { name: string; totals: Record<string, number>; children: Map<string, TreeNode> };
    const emptyTotals = (): Record<string, number> => Object.fromEntries(periods.map((p) => [p, 0]));
    const revTree = new Map<string, TreeNode>();
    const expTree = new Map<string, TreeNode>();
    const dateField = mode === "caixa" ? "payment_date" : "competence_date";

    transactions.forEach((t) => {
      const dateStr: string | null = t[dateField];
      if (!dateStr) return;
      const pKey = dateToPeriodKey(dateStr, granularity);
      if (!periods.includes(pKey)) return;

      const amount = Number(t.amount) || 0;
      const chain = buildChain(t.category, t.subcategory, t.subcategory2);
      const tree = t.type === "receita" ? revTree : expTree;
      let level = tree;
      for (const { id, name } of chain) {
        let node = level.get(id);
        if (!node) { node = { name, totals: emptyTotals(), children: new Map() }; level.set(id, node); }
        node.totals[pKey] = (node.totals[pKey] || 0) + amount;
        level = node.children;
      }
    });

    const toRows = (m: Map<string, TreeNode>): DRECategoryRow[] =>
      Array.from(m.entries())
        .map(([id, node]) => ({ categoryId: id, categoryName: node.name, monthlyTotals: node.totals, children: toRows(node.children) }))
        .sort((a, b) => {
          const ta = Object.values(a.monthlyTotals).reduce((s, v) => s + v, 0);
          const tb = Object.values(b.monthlyTotals).reduce((s, v) => s + v, 0);
          return tb - ta;
        });

    const revRows = toRows(revTree);
    const expRows = toRows(expTree);
    const sumRow = (rows: DRECategoryRow[]): Record<string, number> => {
      const s = emptyTotals();
      rows.forEach((r) => periods.forEach((p) => (s[p] += r.monthlyTotals[p] || 0)));
      return s;
    };
    const mrt = sumRow(revRows);
    const met = sumRow(expRows);
    const mr: Record<string, number> = {};
    periods.forEach((p) => (mr[p] = mrt[p] - met[p]));

    return { revenueRows: revRows, expenseRows: expRows, monthlyRevenueTotals: mrt, monthlyExpenseTotals: met, monthlyResults: mr };
  }, [transactions, buildChain, periods, granularity, mode]);

  return { periods, loading, ...data };
}

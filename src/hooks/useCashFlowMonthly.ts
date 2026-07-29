import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { applyCompanyFilter } from "@/lib/companyFilter";
import { splitContextNeutralTransfers } from "@/lib/transferVisibility";
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

interface TxRow {
  id: string;
  amount: number | string;
  type: "receita" | "despesa";
  status: string;
  category: string | null;
  subcategory: string | null;
  subcategory2: string | null;
  payment_date: string | null;
  competence_date: string | null;
  bank_account_id: string | null;
  credit_card_id: string | null;
  transfer_id: string | null;
  is_internal_transfer: boolean | null;
}

// Untyped helper so supabase-js doesn't try to parse interpolated select strings.
const sel = (s: string): string => s;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const SEM_CAT_KEY = "__sem_categoria__";
const SEM_CAT_LABEL = "Sem categoria";

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

export function useCashFlowMonthly(mode: CashFlowMode, filters: CashFlowMonthlyFilters) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected } = useCompany();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
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
    if (!user || !effectiveUserId) return;
    let cancelled = false;
    const fetchCats = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("user_id", effectiveUserId);
      if (!cancelled && data) setCategories(data as CategoryRecord[]);
    };
    const fetchCards = async () => {
      let q = supabase.from("credit_cards").select("id, bank_account_id");
      q = applyCompanyFilter(q, { effectiveUserId, viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected });
      const { data } = await q;
      if (!cancelled && data) setCreditCards(data as { id: string; bank_account_id: string }[]);
    };
    fetchCats();
    fetchCards();
    return () => { cancelled = true; };
  }, [user, effectiveUserId, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected]);

  useEffect(() => {
    if (!user || !effectiveUserId) return;
    let cancelled = false;
    const dateField = mode === "caixa" ? "payment_date" : "competence_date";

    const buildQuery = () => {
      let q = supabase
        .from("transactions")
        .select(sel(`id, amount, type, status, category, subcategory, subcategory2, payment_date, competence_date, bank_account_id, credit_card_id, transfer_id, is_internal_transfer`))
        .gte(dateField, startStr)
        .lte(dateField, endStr);
      if (mode === "caixa") q = q.eq("status", "Pago");
      q = applyCompanyFilter(q, { effectiveUserId, viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected });
      if (accountId) {
        if (linkedCardIds.length > 0) {
          q = q.or(`bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(",")})`);
        } else {
          q = q.eq("bank_account_id", accountId);
        }
      }
      return q;
    };

    const fetchTx = async () => {
      setLoading(true);
      const allData: TxRow[] = [];
      const pageSize = 1000;
      let page = 0;
      while (true) {
        const { data, error } = await buildQuery().range(page * pageSize, (page + 1) * pageSize - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...(data as unknown as TxRow[]));
        if (data.length < pageSize) break;
        page++;
        if (page > 50) break; // hard safety cap
      }
      if (cancelled) return;
      setTransactions(splitContextNeutralTransfers(allData).included as TxRow[]);
      setLoading(false);
    };
    fetchTx();
    return () => { cancelled = true; };
  }, [user, effectiveUserId, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, startStr, endStr, accountId, linkedCardIds, mode]);

  // Index categories by id and lowercased name for O(1) lookup.
  const catById = useMemo(() => {
    const m = new Map<string, CategoryRecord>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);
  const catByLName = useMemo(() => {
    const m = new Map<string, CategoryRecord>();
    // First occurrence wins (categories already de-duped in DB).
    categories.forEach((c) => {
      const k = c.name.trim().toLowerCase();
      if (!m.has(k)) m.set(k, c);
    });
    return m;
  }, [categories]);

  // Resolve a reference (UUID or free text) to a canonical record.
  // Returns null when the value is an unknown UUID (orphan) or falsy → caller
  // should bucket into "Sem categoria".
  const resolveRef = useCallback(
    (value: string | null | undefined): { key: string; label: string; record?: CategoryRecord } | null => {
      if (!value) return null;
      const byId = catById.get(value);
      if (byId) return { key: `n:${byId.name.trim().toLowerCase()}`, label: byId.name, record: byId };
      if (isUuid(value)) return null; // unknown UUID → sem categoria bucket
      const lname = value.trim().toLowerCase();
      const byName = catByLName.get(lname);
      if (byName) return { key: `n:${byName.name.trim().toLowerCase()}`, label: byName.name, record: byName };
      // Free-text label without a matching category: preserve its name but
      // group case-insensitively so "SALÁRIOS" and "Salários" collapse.
      return { key: `n:${lname}`, label: value };
    },
    [catById, catByLName]
  );

  const buildChain = useCallback(
    (
      category: string | null,
      subcategory: string | null,
      subcategory2: string | null
    ): { key: string; label: string }[] => {
      const chain: { key: string; label: string }[] = [];

      const seed = resolveRef(category);
      if (seed?.record && seed.record.parent_id) {
        // Walk up the parent chain from the resolved node.
        const stack: CategoryRecord[] = [];
        let curr: CategoryRecord | undefined = seed.record;
        const guard = new Set<string>();
        while (curr && !guard.has(curr.id)) {
          guard.add(curr.id);
          stack.unshift(curr);
          curr = curr.parent_id ? catById.get(curr.parent_id) : undefined;
        }
        stack.forEach((c) => chain.push({ key: `n:${c.name.trim().toLowerCase()}`, label: c.name }));
      } else if (seed) {
        chain.push({ key: seed.key, label: seed.label });
      }

      const sub = resolveRef(subcategory);
      if (sub && !chain.some((c) => c.key === sub.key)) chain.push({ key: sub.key, label: sub.label });

      const sub2 = resolveRef(subcategory2);
      if (sub2 && !chain.some((c) => c.key === sub2.key)) chain.push({ key: sub2.key, label: sub2.label });

      if (chain.length === 0) chain.push({ key: SEM_CAT_KEY, label: SEM_CAT_LABEL });
      return chain;
    },
    [resolveRef, catById]
  );

  const periods = useMemo(() => buildPeriodKeys(year, granularity), [year, granularity]);

  const data = useMemo(() => {
    type TreeNode = { name: string; totals: Record<string, number>; children: Map<string, TreeNode> };
    const emptyTotals = (): Record<string, number> => Object.fromEntries(periods.map((p) => [p, 0]));
    const revTree = new Map<string, TreeNode>();
    const expTree = new Map<string, TreeNode>();
    const dateField = mode === "caixa" ? "payment_date" : "competence_date";

    transactions.forEach((t) => {
      const dateStr = t[dateField as "payment_date" | "competence_date"];
      if (!dateStr) return;
      const pKey = dateToPeriodKey(dateStr, granularity);
      if (!periods.includes(pKey)) return;

      const amount = Number(t.amount) || 0;
      const chain = buildChain(t.category, t.subcategory, t.subcategory2);
      const tree = t.type === "receita" ? revTree : expTree;
      let level = tree;
      for (const { key, label } of chain) {
        let node = level.get(key);
        if (!node) {
          node = { name: label, totals: emptyTotals(), children: new Map() };
          level.set(key, node);
        }
        node.totals[pKey] = (node.totals[pKey] || 0) + amount;
        level = node.children;
      }
    });

    const toRows = (m: Map<string, TreeNode>): DRECategoryRow[] =>
      Array.from(m.entries())
        .map(([key, node]) => ({
          categoryId: key,
          categoryName: node.name,
          monthlyTotals: node.totals,
          children: toRows(node.children),
        }))
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

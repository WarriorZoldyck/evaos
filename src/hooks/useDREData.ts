import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { applyCompanyFilter } from "@/lib/companyFilter";

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
  viewMode?: "contabil" | "gerencial";
}

export interface DRESection {
  key: string;
  label: string;
  sign: "+" | "-" | "=";
  monthlyTotals: Record<string, number>;
  categoryRows: DRECategoryRow[];
  isCalculated: boolean;
}

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
  dre_section: string | null;
  type: string | null;
}

// ── DRE section keys ──────────────────────────────

import { VALID_SECTION_KEYS as SHARED_VALID_KEYS, normalizeLegacySection, type DreSectionKey as SharedDreKey } from "@/lib/dreSections";

type DreSectionKey = SharedDreKey;

const VALID_SECTION_KEYS: DreSectionKey[] = SHARED_VALID_KEYS as DreSectionKey[];


// ── Period helpers ──────────────────────────────

function buildPeriodKeys(year: number, granularity: DREGranularity): string[] {
  if (granularity === "monthly") {
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }
  if (granularity === "quarterly") {
    return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  }
  return [`${year}-S1`, `${year}-S2`];
}

export function getPeriodLabel(key: string): string {
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

// ── Hook ──────────────────────────────

export function useDREData(filters: DREFilters) {
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
      const { data } = await supabase.from("categories").select("id, name, parent_id, dre_section, type");
      if (data) setCategories(data as CategoryRecord[]);
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
      let q = supabase
        .from("transactions")
        .select("id, amount, type, category, subcategory, subcategory2, competence_date, bank_account_id, credit_card_id, transfer_id")
        .gte("competence_date", startStr)
        .lte("competence_date", endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false")
        .not("category", "ilike", "transfer%")
        .not("category", "ilike", "transferência%");

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
  }, [user, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected, startStr, endStr, accountId, linkedCardIds]);

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
        if (sub && !chain.some((c) => c.id === sub.id)) chain.push(sub);
      }
      if (subcategory2) {
        const sub2 = resolveName(subcategory2);
        if (sub2 && !chain.some((c) => c.id === sub2.id)) chain.push(sub2);
      }

      return chain.length > 0 ? chain : [{ id: category, name: category }];
    },
    [categories, resolveName]
  );

  const periods = useMemo(() => buildPeriodKeys(year, granularity), [year, granularity]);

  // ── Gerencial output (original logic) ──
  const gerencialData = useMemo(() => {
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
        if (!node) { node = { name, totals: emptyTotals(), children: new Map() }; currentLevel.set(id, node); }
        node.totals[pKey] = (node.totals[pKey] || 0) + amount;
        currentLevel = node.children;
      }
    });

    const toRows = (m: Map<string, TreeNode>): DRECategoryRow[] =>
      Array.from(m.entries())
        .map(([id, node]) => ({ categoryId: id, categoryName: node.name, monthlyTotals: node.totals, children: toRows(node.children) }))
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

  // ── Contábil output (new accounting structure) ──
  const contabilData = useMemo(() => {
    const emptyTotals = (): Record<string, number> => Object.fromEntries(periods.map((p) => [p, 0]));

    // Buckets for each DRE section
    type TreeNode = { name: string; totals: Record<string, number>; children: Map<string, TreeNode> };
    const sectionTrees: Record<DreSectionKey, Map<string, TreeNode>> = {
      receita_operacional: new Map(),
      impostos_venda: new Map(),
      cmv_csp: new Map(),
      despesas_vendas: new Map(),
      despesas_operacionais: new Map(),
      despesas_financeiras: new Map(),
      receita_financeira: new Map(),
      despesas_gerais: new Map(),
      depreciacao_amortizacao: new Map(),
      tributos_sobre_lucro: new Map(),
    };

    // Walk a category up to its root and return the FIRST (root-most) explicit
    // dre_section found in the ancestry chain. NO automatic fallback by type and
    // NO "Não Classificadas" rows: unmapped categories are ignored by the DRE.
    const sectionFor = (cat: CategoryRecord): DreSectionKey | null => {
      const ancestry: CategoryRecord[] = [];
      let current: CategoryRecord | undefined = cat;
      while (current) {
        ancestry.push(current);
        current = current.parent_id ? categories.find((c) => c.id === current!.parent_id) : undefined;
      }
      for (let i = ancestry.length - 1; i >= 0; i--) {
        const v = normalizeLegacySection(ancestry[i].dre_section);
        if (v && VALID_SECTION_KEYS.includes(v as DreSectionKey)) {
          return v as DreSectionKey;
        }
      }
      return null;
    };

    const resolveDreSection = (categoryRef: string | null | undefined): DreSectionKey | null => {
      if (!categoryRef) return null;
      const byId = categories.find((c) => c.id === categoryRef);
      if (byId) return sectionFor(byId);
      const homonyms = categories.filter(
        (c) => c.name.toLowerCase() === categoryRef.toLowerCase()
      );
      for (const h of homonyms) {
        const s = sectionFor(h);
        if (s) return s;
      }
      return null;
    };

    const unmappedCategoryIds = new Set<string>();

    transactions.forEach((t) => {
      const amount = Number(t.amount);
      const pKey = dateToPeriodKey(t.competence_date, granularity);
      if (!periods.includes(pKey)) return;

      const chain = buildChain(t.category, t.subcategory, t.subcategory2);

      let sectionKey: DreSectionKey | null = null;
      const refsInOrder = [t.subcategory2, t.subcategory, t.category];
      for (const ref of refsInOrder) {
        sectionKey = resolveDreSection(ref);
        if (sectionKey) break;
      }

      if (!sectionKey) {
        if (chain[0]) unmappedCategoryIds.add(chain[0].id);
        return;
      }

      const tree = sectionTrees[sectionKey];
      let currentLevel = tree;
      for (const { id, name } of chain) {
        let node = currentLevel.get(id);
        if (!node) { node = { name, totals: emptyTotals(), children: new Map() }; currentLevel.set(id, node); }
        node.totals[pKey] = (node.totals[pKey] || 0) + amount;
        currentLevel = node.children;
      }
    });

    const toRows = (m: Map<string, TreeNode>): DRECategoryRow[] =>
      Array.from(m.entries())
        .map(([id, node]) => ({ categoryId: id, categoryName: node.name, monthlyTotals: node.totals, children: toRows(node.children) }))
        .sort((a, b) => {
          const totalA = Object.values(a.monthlyTotals).reduce((s, v) => s + v, 0);
          const totalB = Object.values(b.monthlyTotals).reduce((s, v) => s + v, 0);
          return totalB - totalA;
        });

    const sumTree = (m: Map<string, TreeNode>): Record<string, number> => {
      const sums = emptyTotals();
      m.forEach((node) => periods.forEach((p) => (sums[p] += node.totals[p] || 0)));
      return sums;
    };

    const recOp = sumTree(sectionTrees.receita_operacional);
    const impVenda = sumTree(sectionTrees.impostos_venda);
    const cmv = sumTree(sectionTrees.cmv_csp);
    const despVendas = sumTree(sectionTrees.despesas_vendas);
    const despOp = sumTree(sectionTrees.despesas_operacionais);
    const despFin = sumTree(sectionTrees.despesas_financeiras);
    const recFin = sumTree(sectionTrees.receita_financeira);
    const despGerais = sumTree(sectionTrees.despesas_gerais);
    const depAmort = sumTree(sectionTrees.depreciacao_amortizacao);
    const tributosLucro = sumTree(sectionTrees.tributos_sobre_lucro);

    // Calculated subtotals use only categories explicitly mapped to cost centers.
    const recLiquida = emptyTotals();
    const lucroBruto = emptyTotals();
    const ebitda = emptyTotals();
    const ebit = emptyTotals();
    const resultadoFinanceiro = emptyTotals();
    const lair = emptyTotals();
    const lucroLiquido = emptyTotals();
    periods.forEach((p) => {
      recLiquida[p] = recOp[p] - impVenda[p];
      lucroBruto[p] = recLiquida[p] - cmv[p];
      ebitda[p] = lucroBruto[p] - despVendas[p] - despOp[p] - despGerais[p];
      ebit[p] = ebitda[p] - depAmort[p];
      resultadoFinanceiro[p] = recFin[p] - despFin[p];
      lair[p] = ebit[p] + resultadoFinanceiro[p];
      lucroLiquido[p] = lair[p] - tributosLucro[p];
    });

    const hasDepAmort = Object.values(depAmort).some((v) => v !== 0) || sectionTrees.depreciacao_amortizacao.size > 0;
    const hasTributos = Object.values(tributosLucro).some((v) => v !== 0) || sectionTrees.tributos_sobre_lucro.size > 0;

    const sections: DRESection[] = [
      { key: "receita_operacional", label: "(+) Receita Operacional Bruta", sign: "+", monthlyTotals: recOp, categoryRows: toRows(sectionTrees.receita_operacional), isCalculated: false },
      { key: "impostos_venda", label: "(-) Deduções e Impostos s/ Venda", sign: "-", monthlyTotals: impVenda, categoryRows: toRows(sectionTrees.impostos_venda), isCalculated: false },
      { key: "receita_liquida", label: "(=) Receita Líquida", sign: "=", monthlyTotals: recLiquida, categoryRows: [], isCalculated: true },
      { key: "cmv_csp", label: "(-) Custo das Mercadorias/Serviços", sign: "-", monthlyTotals: cmv, categoryRows: toRows(sectionTrees.cmv_csp), isCalculated: false },
      { key: "lucro_bruto", label: "(=) Lucro Bruto", sign: "=", monthlyTotals: lucroBruto, categoryRows: [], isCalculated: true },
      { key: "despesas_vendas", label: "(-) Despesas com Vendas", sign: "-", monthlyTotals: despVendas, categoryRows: toRows(sectionTrees.despesas_vendas), isCalculated: false },
      { key: "despesas_operacionais", label: "(-) Despesas Operacionais e Adm.", sign: "-", monthlyTotals: despOp, categoryRows: toRows(sectionTrees.despesas_operacionais), isCalculated: false },
      { key: "despesas_gerais", label: "(-) Despesas Gerais e Adm.", sign: "-", monthlyTotals: despGerais, categoryRows: toRows(sectionTrees.despesas_gerais), isCalculated: false },
      { key: "ebitda", label: "(=) EBITDA", sign: "=", monthlyTotals: ebitda, categoryRows: [], isCalculated: true },
      ...(hasDepAmort ? [{ key: "depreciacao_amortizacao", label: "(-) Depreciação e Amortização", sign: "-" as const, monthlyTotals: depAmort, categoryRows: toRows(sectionTrees.depreciacao_amortizacao), isCalculated: false }] : []),
      { key: "ebit", label: "(=) EBIT (Resultado Operacional)", sign: "=", monthlyTotals: ebit, categoryRows: [], isCalculated: true },
      { key: "receita_financeira", label: "(+) Receitas Financeiras", sign: "+", monthlyTotals: recFin, categoryRows: toRows(sectionTrees.receita_financeira), isCalculated: false },
      { key: "despesas_financeiras", label: "(-) Despesas Financeiras", sign: "-", monthlyTotals: despFin, categoryRows: toRows(sectionTrees.despesas_financeiras), isCalculated: false },
      { key: "resultado_financeiro", label: "(=) Resultado Financeiro", sign: "=", monthlyTotals: resultadoFinanceiro, categoryRows: [], isCalculated: true },
      { key: "lair", label: "(=) LAIR (Lucro Antes de IR/CSLL)", sign: "=", monthlyTotals: lair, categoryRows: [], isCalculated: true },
      ...(hasTributos ? [{ key: "tributos_sobre_lucro", label: "(-) IRPJ / CSLL", sign: "-" as const, monthlyTotals: tributosLucro, categoryRows: toRows(sectionTrees.tributos_sobre_lucro), isCalculated: false }] : []),
      { key: "lucro_liquido", label: "(=) Lucro Líquido do Exercício", sign: "=", monthlyTotals: lucroLiquido, categoryRows: [], isCalculated: true },
    ];

    return { sections, recOp, recLiquida, lucroBruto, ebitda, ebit, resultadoFinanceiro, lair, lucroLiquido, unmappedCategoryCount: unmappedCategoryIds.size };
  }, [transactions, buildChain, periods, granularity, categories]);

  return {
    periods,
    loading,
    // Gerencial
    revenueRows: gerencialData.revenueRows,
    expenseRows: gerencialData.expenseRows,
    monthlyRevenueTotals: gerencialData.monthlyRevenueTotals,
    monthlyExpenseTotals: gerencialData.monthlyExpenseTotals,
    monthlyResults: gerencialData.monthlyResults,
    // Contábil
    sections: contabilData.sections,
    unmappedCategoryCount: contabilData.unmappedCategoryCount,
    indicators: {
      receitaOperacional: contabilData.recOp,
      receitaLiquida: contabilData.recLiquida,
      lucroBruto: contabilData.lucroBruto,
      ebitda: contabilData.ebitda,
      ebit: contabilData.ebit,
      resultadoFinanceiro: contabilData.resultadoFinanceiro,
      lair: contabilData.lair,
      lucroLiquido: contabilData.lucroLiquido,
    },
  };
}

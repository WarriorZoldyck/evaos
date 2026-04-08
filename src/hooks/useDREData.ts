import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

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
}

// ── Keyword-based classification ──────────────────────────────

type DreSectionKey =
  | "receita_operacional"
  | "impostos_venda"
  | "cmv_csp"
  | "despesas_vendas"
  | "despesas_operacionais"
  | "despesas_financeiras"
  | "receita_financeira"
  | "despesas_gerais";

const SECTION_KEYWORDS: Record<DreSectionKey, string[]> = {
  impostos_venda: [
    "imposto", "tributo", "iss", "icms", "pis", "cofins", "simples nacional",
    "simples", "das", "darf", "irpj", "csll", "inss empresa", "contribuição social",
  ],
  cmv_csp: [
    "cmv", "cpv", "csp", "custo de mercadoria", "custo de produto", "custo de serviço",
    "matéria-prima", "materia-prima", "insumo", "custo direto",
  ],
  despesas_vendas: [
    "comissão", "comissao", "frete de venda", "propaganda", "marketing",
    "publicidade", "anúncio", "anuncio", "representante",
  ],
  despesas_financeiras: [
    "juros", "tarifa bancária", "tarifa bancaria", "iof", "taxa bancária",
    "taxa bancaria", "multa bancária", "multa bancaria", "taxa de cartão",
    "taxa cartão", "taxa cartao", "anuidade",
  ],
  receita_financeira: [
    "rendimento", "aplicação financeira", "aplicacao financeira",
    "juros recebidos", "receita financeira", "resgate",
  ],
  despesas_operacionais: [
    "aluguel", "energia", "água", "agua", "salário", "salario", "folha",
    "pro-labore", "pró-labore", "prolabore", "contabilidade", "contador",
    "software", "internet", "telefone", "iptu", "ipva", "combustível",
    "combustivel", "seguro", "depreciação", "depreciacao", "limpeza",
    "material de escritório", "material de escritorio", "manutenção", "manutencao",
  ],
  receita_operacional: [],
  despesas_gerais: [],
};

function classifyCategory(
  catName: string,
  txType: "receita" | "despesa",
  fullChainNames: string[],
  explicitSection?: string | null
): DreSectionKey {
  // Priority: explicit dre_section from database
  if (explicitSection && explicitSection in SECTION_KEYWORDS) {
    return explicitSection as DreSectionKey;
  }

  const lower = fullChainNames.map((n) => n.toLowerCase()).join(" ") + " " + catName.toLowerCase();

  // For receita, check receita_financeira first
  if (txType === "receita") {
    if (SECTION_KEYWORDS.receita_financeira.some((kw) => lower.includes(kw))) {
      return "receita_financeira";
    }
    return "receita_operacional";
  }

  // For despesa, check in priority order
  const orderedSections: DreSectionKey[] = [
    "impostos_venda",
    "cmv_csp",
    "despesas_vendas",
    "despesas_financeiras",
    "despesas_operacionais",
  ];

  for (const section of orderedSections) {
    if (SECTION_KEYWORDS[section].some((kw) => lower.includes(kw))) {
      return section;
    }
  }

  return "despesas_gerais";
}

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

  useEffect(() => {
    if (!user) return;
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("id, name, parent_id, dre_section");
      if (data) setCategories(data as CategoryRecord[]);
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

  useEffect(() => {
    if (!user) return;
    const fetchTx = async () => {
      setLoading(true);
      let q = supabase
        .from("transactions")
        .select("id, amount, type, category, subcategory, subcategory2, competence_date, bank_account_id, credit_card_id, transfer_id")
        .gte("competence_date", startStr)
        .lte("competence_date", endStr)
        .or("transfer_id.is.null,is_internal_transfer.eq.false");

      if (isPersonal) q = q.is("company_id", null);
      else if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);

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
    };

    transactions.forEach((t) => {
      const amount = Number(t.amount);
      const pKey = dateToPeriodKey(t.competence_date, granularity);
      if (!periods.includes(pKey)) return;

      const chain = buildChain(t.category, t.subcategory, t.subcategory2);
      const chainNames = chain.map((c) => c.name);
      const sectionKey = classifyCategory(chain[0]?.name || t.category, t.type, chainNames);

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
      // Sum only root-level nodes (they already contain accumulated totals)
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

    // Calculated rows
    const recLiquida = emptyTotals();
    const lucroBruto = emptyTotals();
    const lucroLiquido = emptyTotals();
    periods.forEach((p) => {
      recLiquida[p] = recOp[p] - impVenda[p];
      lucroBruto[p] = recLiquida[p] - cmv[p];
      lucroLiquido[p] = lucroBruto[p] - despVendas[p] - despOp[p] - despFin[p] + recFin[p] - despGerais[p];
    });

    const sections: DRESection[] = [
      { key: "receita_operacional", label: "(+) Receita Operacional Bruta", sign: "+", monthlyTotals: recOp, categoryRows: toRows(sectionTrees.receita_operacional), isCalculated: false },
      { key: "impostos_venda", label: "(-) Deduções e Impostos s/ Venda", sign: "-", monthlyTotals: impVenda, categoryRows: toRows(sectionTrees.impostos_venda), isCalculated: false },
      { key: "receita_liquida", label: "(=) Receita Líquida", sign: "=", monthlyTotals: recLiquida, categoryRows: [], isCalculated: true },
      { key: "cmv_csp", label: "(-) Custo das Mercadorias/Serviços", sign: "-", monthlyTotals: cmv, categoryRows: toRows(sectionTrees.cmv_csp), isCalculated: false },
      { key: "lucro_bruto", label: "(=) Lucro Bruto", sign: "=", monthlyTotals: lucroBruto, categoryRows: [], isCalculated: true },
      { key: "despesas_vendas", label: "(-) Despesas com Vendas", sign: "-", monthlyTotals: despVendas, categoryRows: toRows(sectionTrees.despesas_vendas), isCalculated: false },
      { key: "despesas_operacionais", label: "(-) Despesas Operacionais e Adm.", sign: "-", monthlyTotals: despOp, categoryRows: toRows(sectionTrees.despesas_operacionais), isCalculated: false },
      { key: "despesas_financeiras", label: "(-) Despesas Financeiras", sign: "-", monthlyTotals: despFin, categoryRows: toRows(sectionTrees.despesas_financeiras), isCalculated: false },
      { key: "receita_financeira", label: "(+) Receita Financeira", sign: "+", monthlyTotals: recFin, categoryRows: toRows(sectionTrees.receita_financeira), isCalculated: false },
      { key: "despesas_gerais", label: "(-) Despesas Gerais e Adm.", sign: "-", monthlyTotals: despGerais, categoryRows: toRows(sectionTrees.despesas_gerais), isCalculated: false },
      { key: "lucro_liquido", label: "(=) Resultado Líquido do Exercício", sign: "=", monthlyTotals: lucroLiquido, categoryRows: [], isCalculated: true },
    ];

    return { sections, recOp, lucroBruto, lucroLiquido };
  }, [transactions, buildChain, periods, granularity]);

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
    indicators: {
      receitaOperacional: contabilData.recOp,
      lucroBruto: contabilData.lucroBruto,
      lucroLiquido: contabilData.lucroLiquido,
    },
  };
}

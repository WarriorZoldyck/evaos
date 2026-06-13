// Single source of truth for DRE sections. Used by:
// - src/hooks/useDREData.ts (calculation engine)
// - src/pages/CentrosDeCustos.tsx (drag-and-drop buckets)
// - src/components/categorias/CategoryFormModal.tsx (per-category select)

export type DreSectionKey =
  | "receita_operacional"
  | "impostos_venda"
  | "cmv_csp"
  | "despesas_vendas"
  | "despesas_operacionais"
  | "despesas_gerais"
  | "depreciacao_amortizacao"
  | "receita_financeira"
  | "despesas_financeiras"
  | "tributos_sobre_lucro";

export interface DreSectionDef {
  key: DreSectionKey;
  label: string;
  sign: "+" | "-";
  /** legacy bucket kept in CC behind a feature toggle */
  legacy?: boolean;
}

// Order follows the escalonada DRE structure.
export const DRE_SECTIONS: DreSectionDef[] = [
  { key: "receita_operacional", label: "Receita Operacional", sign: "+" },
  { key: "impostos_venda", label: "Deduções e Impostos sobre Venda", sign: "-" },
  { key: "cmv_csp", label: "CMV / CSP (Custos)", sign: "-" },
  { key: "despesas_vendas", label: "Despesas com Vendas", sign: "-" },
  { key: "despesas_operacionais", label: "Despesas Operacionais e Adm.", sign: "-" },
  { key: "despesas_gerais", label: "Despesas Gerais e Adm.", sign: "-" },
  { key: "depreciacao_amortizacao", label: "Depreciação e Amortização", sign: "-" },
  { key: "receita_financeira", label: "Receita Financeira", sign: "+" },
  { key: "despesas_financeiras", label: "Despesas Financeiras", sign: "-" },
  { key: "tributos_sobre_lucro", label: "IRPJ / CSLL (Tributos sobre o Lucro)", sign: "-" },
];

export const VALID_SECTION_KEYS: DreSectionKey[] = DRE_SECTIONS.map((s) => s.key);

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  DRE_SECTIONS.map((s) => [s.key, s.label])
);

/**
 * Legacy "mdr" key used to route to nowhere (bug). MDR fees are, by accounting
 * convention, Despesas com Vendas. This normalizer is applied by the DRE
 * resolver so historical and future MDR categories always sum correctly.
 */
export function normalizeLegacySection(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key === "mdr") return "despesas_vendas";
  return key;
}

/**
 * Smart default when a category has no explicit `dre_section`. We use the
 * category's own `type` (receita/despesa) to pick a sensible bucket so users
 * don't have to drag every single category to a cost center. The Centros de
 * Custos UI shows these as "Automático" so the user knows they can override.
 */
export function defaultSectionForType(type: string | null | undefined): DreSectionKey | null {
  if (type === "receita") return "receita_operacional";
  if (type === "despesa") return "despesas_operacionais";
  return null;
}


/**
 * Camada 2 do Planejamento: alocação da sobra em Objetivos.
 * Funções puras — sem React, sem Supabase.
 */

export type GoalType = "reserva" | "sonho" | "investimento" | "divida" | "outro";
export type AllocationMode = "fixed" | "percent";

export interface AllocationInput {
  mode: AllocationMode;
  /** Valor fixo mensal em reais (usado quando mode === "fixed"). */
  amount?: number;
  /** Percentual da sobra mensal (usado quando mode === "percent"). */
  percent?: number;
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  reserva: "Reserva de emergência",
  sonho: "Sonho / conquista",
  investimento: "Investimento",
  divida: "Quitar dívida",
  outro: "Outro",
};

export const GOAL_TYPE_ORDER: GoalType[] = [
  "reserva",
  "divida",
  "sonho",
  "investimento",
  "outro",
];

export function isGoalType(value: unknown): value is GoalType {
  return typeof value === "string" && value in GOAL_TYPE_LABELS;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Converte a alocação configurada em reais por mês, dado o valor da sobra. */
export function monthlyFromAllocation(alloc: AllocationInput, leftoverMonthly: number): number {
  const base = Math.max(0, leftoverMonthly);
  if (alloc.mode === "percent") {
    const pct = Math.min(100, Math.max(0, alloc.percent ?? 0));
    return round2((base * pct) / 100);
  }
  return round2(Math.max(0, alloc.amount ?? 0));
}

/** Converte um valor em reais no percentual equivalente da sobra. */
export function percentFromMonthly(monthly: number, leftoverMonthly: number): number {
  if (leftoverMonthly <= 0) return 0;
  return round2(Math.min(100, Math.max(0, (monthly / leftoverMonthly) * 100)));
}

/** Soma as alocações mensais de vários objetivos. */
export function sumAllocations(
  items: AllocationInput[],
  leftoverMonthly: number,
): number {
  return round2(
    items.reduce((sum, item) => sum + monthlyFromAllocation(item, leftoverMonthly), 0),
  );
}

export interface AllocationBudget {
  /** Sobra mensal disponível (nunca negativa). */
  total: number;
  /** Já comprometido com objetivos existentes. */
  committed: number;
  /** Ainda livre para novos objetivos. */
  free: number;
  /** Percentual comprometido (0–100+). */
  committedPercent: number;
  /** Verdadeiro quando o comprometido passa da sobra. */
  overCommitted: boolean;
}

/** Quanto da sobra já está comprometido e quanto ainda está livre. */
export function buildAllocationBudget(
  leftoverMonthly: number,
  existing: AllocationInput[],
): AllocationBudget {
  const total = round2(Math.max(0, leftoverMonthly));
  const committed = sumAllocations(existing, total);
  const free = round2(Math.max(0, total - committed));
  const committedPercent = total > 0 ? round2((committed / total) * 100) : committed > 0 ? 100 : 0;
  return {
    total,
    committed,
    free,
    committedPercent,
    overCommitted: committed - total > 0.009,
  };
}

/** Valida uma nova alocação contra a sobra livre. */
export function validateAllocation(
  alloc: AllocationInput,
  budget: AllocationBudget,
): { valid: boolean; monthly: number; error?: string } {
  const monthly = monthlyFromAllocation(alloc, budget.total);
  if (monthly <= 0) {
    return { valid: false, monthly, error: "Defina um valor mensal maior que zero." };
  }
  if (monthly - budget.free > 0.009) {
    return {
      valid: false,
      monthly,
      error: "Esse valor passa do que ainda sobra por mês.",
    };
  }
  return { valid: true, monthly };
}

/** Alvo do objetivo a partir do aporte mensal e do número de meses. */
export function targetFromMonthly(monthly: number, months: number): number {
  return round2(Math.max(0, monthly) * Math.max(1, Math.round(months)));
}

/**
 * Acompanhamento determinístico das metas orçamentárias do mês corrente.
 * Sem IA: os números têm que bater exatamente com o que aparece na tela
 * e com o que a EVA responde no WhatsApp.
 */

export type BudgetKind = "income" | "expense";

/** ok = tranquilo · near = se aproximando · over = estourou (saídas)
 *  behind = abaixo do ritmo · reached = meta batida (entradas) */
export type BudgetStatus = "ok" | "near" | "over" | "behind" | "reached";

export interface CategoryProgressInput {
  name: string;
  /** Média mensal histórica da categoria (alvo automático). */
  average: number;
  /** Total já efetivado (pago) neste mês. */
  actual: number;
  /** Meta mensal salva pelo usuário. null/undefined => usa a média. */
  target?: number | null;
}

export interface CategoryProgress {
  name: string;
  kind: BudgetKind;
  average: number;
  actual: number;
  /** Alvo efetivamente usado no cálculo. */
  target: number;
  /** true quando o alvo veio da média histórica (usuário não definiu meta). */
  isAutoTarget: boolean;
  /** Saídas: quanto ainda cabe. Entradas: quanto falta receber. Nunca negativo. */
  remaining: number;
  /** Quanto passou do alvo (saídas). 0 quando não estourou. */
  overBy: number;
  /** 0..∞ — percentual do alvo já consumido/alcançado. */
  consumedPct: number;
  /** Consumo dividido pela fração do mês já decorrida. >1.15 = rápido demais. */
  paceRatio: number;
  status: BudgetStatus;
  message: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export const NEAR_THRESHOLD_PCT = 80;
const PACE_TOLERANCE = 1.15;

/** Fração do mês já decorrida (0 < r <= 1). */
export function monthElapsedRatio(now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(1, Math.max(1 / daysInMonth, now.getDate() / daysInMonth));
}

function formatBRLShort(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildCategoryProgress(
  input: CategoryProgressInput,
  kind: BudgetKind,
  now: Date = new Date(),
): CategoryProgress {
  const average = round2(Math.max(0, input.average || 0));
  const actual = round2(Math.max(0, input.actual || 0));
  const hasTarget =
    input.target !== null && input.target !== undefined && Number.isFinite(input.target);
  const target = round2(Math.max(0, hasTarget ? Number(input.target) : average));
  const isAutoTarget = !hasTarget;

  const consumedPct = target > 0 ? round2((actual / target) * 100) : actual > 0 ? 100 : 0;
  const elapsed = monthElapsedRatio(now);
  const paceRatio = target > 0 ? round2(actual / target / elapsed) : 0;

  const remaining = round2(Math.max(0, target - actual));
  const overBy = round2(Math.max(0, actual - target));

  let status: BudgetStatus;
  let message: string;

  if (kind === "expense") {
    if (overBy > 0) {
      status = "over";
      message = `Estourou ${formatBRLShort(overBy)} da meta`;
    } else if (consumedPct >= NEAR_THRESHOLD_PCT) {
      status = "near";
      message = `Se aproximando — só cabe mais ${formatBRLShort(remaining)}`;
    } else if (paceRatio > PACE_TOLERANCE) {
      status = "near";
      message = `Gastando rápido demais — restam ${formatBRLShort(remaining)}`;
    } else {
      status = "ok";
      message = `Ainda cabe ${formatBRLShort(remaining)}`;
    }
  } else {
    if (remaining <= 0 && target > 0) {
      status = "reached";
      message = "Meta do mês alcançada";
    } else if (paceRatio < 1 / PACE_TOLERANCE) {
      status = "behind";
      message = `Faltam ${formatBRLShort(remaining)} para a meta`;
    } else {
      status = "ok";
      message = `Faltam ${formatBRLShort(remaining)} — no ritmo`;
    }
  }

  return {
    name: input.name,
    kind,
    average,
    actual,
    target,
    isAutoTarget,
    remaining,
    overBy,
    consumedPct,
    paceRatio,
    status,
    message,
  };
}

export function buildCategoryProgressList(
  items: CategoryProgressInput[],
  kind: BudgetKind,
  now: Date = new Date(),
): CategoryProgress[] {
  return items.map((i) => buildCategoryProgress(i, kind, now));
}

/**
 * Categorias de saída em risco: primeiro as estouradas, depois as que
 * passaram do limite de atenção. É o "no que não posso gastar mais".
 */
export function buildRiskList(progress: CategoryProgress[]): CategoryProgress[] {
  return progress
    .filter((p) => p.kind === "expense" && p.target > 0)
    .filter((p) => p.status === "over" || p.consumedPct >= NEAR_THRESHOLD_PCT)
    .sort((a, b) => b.consumedPct - a.consumedPct);
}

export interface BudgetMonthSummary {
  incomeActual: number;
  incomeTarget: number;
  expenseActual: number;
  expenseTarget: number;
  /** Sobra realizada até agora no mês. */
  realizedLeftover: number;
  /** Sobra prevista se as metas forem cumpridas. */
  targetLeftover: number;
  elapsedPct: number;
  risks: CategoryProgress[];
}

export function buildMonthSummary(
  income: CategoryProgress[],
  expense: CategoryProgress[],
  now: Date = new Date(),
): BudgetMonthSummary {
  const sum = (list: CategoryProgress[], field: "actual" | "target") =>
    round2(list.reduce((s, p) => s + p[field], 0));

  const incomeActual = sum(income, "actual");
  const incomeTarget = sum(income, "target");
  const expenseActual = sum(expense, "actual");
  const expenseTarget = sum(expense, "target");

  return {
    incomeActual,
    incomeTarget,
    expenseActual,
    expenseTarget,
    realizedLeftover: round2(incomeActual - expenseActual),
    targetLeftover: round2(incomeTarget - expenseTarget),
    elapsedPct: Math.round(monthElapsedRatio(now) * 100),
    risks: buildRiskList(expense),
  };
}

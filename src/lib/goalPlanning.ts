/**
 * Domínio puro do Planejamento Inteligente de metas.
 * Sem React, sem rede, sem valores financeiros hardcoded.
 */

// ---------------------------------------------------------------- Tipos

export interface PlanningGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  /** ISO date (YYYY-MM-DD) ou null quando não há prazo definido. */
  deadline: string | null;
  /** Aporte mensal PLANEJADO para esta meta (não é a sobra do mês). */
  monthlyContribution: number;
}

export type GoalStatus =
  | "CONCLUIDA"
  | "ATINGIVEL"
  | "ATINGIVEL_COM_AJUSTES"
  | "EM_RISCO"
  | "NAO_ATINGIVEL"
  | "DADOS_INSUFICIENTES";

/** De onde saiu o valor usado como aporte na avaliação. */
export type ContributionSource = "PLANEJADO" | "CAPACIDADE";

export interface GoalScoreBreakdown {
  monthsRemaining: number | null;
  accumulated: number;
  remainingAmount: number;
  /** (alvo - acumulado) / meses restantes */
  requiredContribution: number | null;
  /** Capacidade financeira mensal estimada do usuário. */
  monthlyCapacity: number;
  /** Aporte mensal planejado para a meta. */
  monthlyContribution: number;
  /** Valor efetivamente considerado na avaliação. */
  effectiveContribution: number;
  contributionSource: ContributionSource;
  /** effectiveContribution - requiredContribution */
  capacityGap: number | null;
  /** effectiveContribution / requiredContribution */
  coverageRatio: number | null;
}

export interface GoalScoreResult {
  score: number;
  status: GoalStatus;
  breakdown: GoalScoreBreakdown;
}

export interface GoalScoreInput {
  goal: PlanningGoal;
  /** Capacidade financeira mensal estimada. */
  monthlyCapacity: number;
  /** Data de referência — injetável para testes determinísticos. */
  now?: Date;
}

// ------------------------------------------------------- Constantes

export const SCORE_WEIGHT_COVERAGE = 0.7;
export const SCORE_WEIGHT_PROGRESS = 0.3;

export const COVERAGE_ATINGIVEL = 1;
export const COVERAGE_COM_AJUSTES = 0.75;
export const COVERAGE_EM_RISCO = 0.4;

export const MAX_SCORE = 100;

// -------------------------------------------------------- Utilidades

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const partial = to.getDate() >= from.getDate() ? 0 : -1;
  return months + partial;
}

export function parseDeadline(deadline: string | null): Date | null {
  if (!deadline) return null;
  const d = new Date(`${deadline.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ------------------------------------------------------ Score puro

export function computeGoalScore(input: GoalScoreInput): GoalScoreResult {
  const { goal, monthlyCapacity } = input;
  const now = input.now ?? new Date();

  const accumulated = Math.max(0, Number(goal.currentAmount) || 0);
  const target = Math.max(0, Number(goal.targetAmount) || 0);
  const remainingAmount = Math.max(0, target - accumulated);

  const deadlineDate = parseDeadline(goal.deadline);
  const monthsRemaining = deadlineDate
    ? Math.max(0, monthsBetween(now, deadlineDate))
    : null;

  const contribution = Math.max(0, Number(goal.monthlyContribution) || 0);
  const capacity = Math.max(0, Number(monthlyCapacity) || 0);
  const contributionSource: ContributionSource =
    contribution > 0 ? "PLANEJADO" : "CAPACIDADE";
  const effectiveContribution = contribution > 0 ? contribution : capacity;

  const progressRatio = target > 0 ? clamp(accumulated / target, 0, 1) : 0;

  const base: GoalScoreBreakdown = {
    monthsRemaining,
    accumulated,
    remainingAmount,
    requiredContribution: null,
    monthlyCapacity: capacity,
    monthlyContribution: contribution,
    effectiveContribution,
    contributionSource,
    capacityGap: null,
    coverageRatio: null,
  };

  // Meta concluída
  if (target > 0 && remainingAmount === 0) {
    return {
      score: MAX_SCORE,
      status: "CONCLUIDA",
      breakdown: {
        ...base,
        requiredContribution: 0,
        capacityGap: effectiveContribution,
        coverageRatio: 1,
      },
    };
  }

  // Sem alvo ou sem prazo → não é possível avaliar
  if (target <= 0 || monthsRemaining === null) {
    return { score: 0, status: "DADOS_INSUFICIENTES", breakdown: base };
  }

  // Prazo vencido (ou vence neste mês) com valor faltando
  if (monthsRemaining === 0) {
    const coverageRatio =
      remainingAmount > 0 ? effectiveContribution / remainingAmount : 1;
    return {
      score: Math.round(SCORE_WEIGHT_PROGRESS * progressRatio * MAX_SCORE),
      status: "NAO_ATINGIVEL",
      breakdown: {
        ...base,
        requiredContribution: remainingAmount,
        capacityGap: effectiveContribution - remainingAmount,
        coverageRatio,
      },
    };
  }

  const requiredContribution = remainingAmount / monthsRemaining;
  const coverageRatio =
    requiredContribution > 0 ? effectiveContribution / requiredContribution : 1;
  const capacityGap = effectiveContribution - requiredContribution;

  const breakdown: GoalScoreBreakdown = {
    ...base,
    requiredContribution,
    capacityGap,
    coverageRatio,
  };

  const score = Math.round(
    (SCORE_WEIGHT_COVERAGE * clamp(coverageRatio, 0, 1) +
      SCORE_WEIGHT_PROGRESS * progressRatio) *
      MAX_SCORE,
  );

  let status: GoalStatus;
  if (coverageRatio >= COVERAGE_ATINGIVEL) status = "ATINGIVEL";
  else if (coverageRatio >= COVERAGE_COM_AJUSTES) status = "ATINGIVEL_COM_AJUSTES";
  else if (coverageRatio >= COVERAGE_EM_RISCO) status = "EM_RISCO";
  else status = "NAO_ATINGIVEL";

  return { score, status, breakdown };
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  CONCLUIDA: "Concluída",
  ATINGIVEL: "Atingível",
  ATINGIVEL_COM_AJUSTES: "Atingível com ajustes",
  EM_RISCO: "Em risco",
  NAO_ATINGIVEL: "Não atingível",
  DADOS_INSUFICIENTES: "Dados insuficientes",
};

export const needsResolution = (status: GoalStatus) =>
  status === "EM_RISCO" || status === "NAO_ATINGIVEL";

// -------------------------------------------- Ações / plano de ação

export type ActionPlanKind =
  | "REDUCE_EXPENSE"
  | "INCREASE_INCOME"
  | "INCREASE_CONTRIBUTION"
  | "EXTEND_DEADLINE"
  | "REDUCE_TARGET"
  | "INVESTMENT";

export type ActionPlanStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO";
export type ActionPlanSource = "SISTEMA" | "IA";

export interface ActionPlanItem {
  id: string;
  kind: ActionPlanKind;
  title: string;
  description: string;
  status: ActionPlanStatus;
  /** Impacto mensal estimado em R$ (null quando não estimável). */
  estimatedMonthlyImpact: number | null;
  category?: string;
  amount?: number;
  source: ActionPlanSource;
}

export interface CategoryAmount {
  name: string;
  total: number;
}

/** Gera itens determinísticos a partir do breakdown e das maiores despesas. */
export function buildActionPlan(
  breakdown: GoalScoreBreakdown,
  topCategories: CategoryAmount[],
): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];
  const required = breakdown.requiredContribution;
  if (required === null) return items;

  items.push({
    id: "sys-contribution",
    kind: "INCREASE_CONTRIBUTION",
    title: `Reservar ${formatBRL(required)} por mês`,
    description:
      breakdown.monthsRemaining && breakdown.monthsRemaining > 0
        ? `Faltam ${formatBRL(breakdown.remainingAmount)} em ${breakdown.monthsRemaining} ${breakdown.monthsRemaining === 1 ? "mês" : "meses"}.`
        : `Faltam ${formatBRL(breakdown.remainingAmount)} para concluir a meta.`,
    status: (breakdown.capacityGap ?? 0) >= 0 ? "EM_ANDAMENTO" : "PENDENTE",
    estimatedMonthlyImpact: required,
    amount: required,
    source: "SISTEMA",
  });

  const deficit = Math.max(0, -(breakdown.capacityGap ?? 0));
  if (deficit > 0) {
    const totalTop = topCategories.reduce((s, c) => s + Math.abs(c.total), 0);
    topCategories.slice(0, 3).forEach((c, i) => {
      const share = totalTop > 0 ? Math.abs(c.total) / totalTop : 0;
      const cut = Math.min(Math.abs(c.total), deficit * share);
      if (cut <= 0) return;
      items.push({
        id: `sys-cut-${i}`,
        kind: "REDUCE_EXPENSE",
        title: `Reduzir ${formatBRL(cut)} em ${c.name}`,
        description: `Gasto médio mensal de ${formatBRL(Math.abs(c.total))} nesta categoria.`,
        status: "PENDENTE",
        estimatedMonthlyImpact: cut,
        category: c.name,
        amount: cut,
        source: "SISTEMA",
      });
    });

    items.push({
      id: "sys-income",
      kind: "INCREASE_INCOME",
      title: `Gerar ${formatBRL(deficit)} a mais por mês`,
      description: "Renda extra cobre a diferença sem mexer nos gastos atuais.",
      status: "PENDENTE",
      estimatedMonthlyImpact: deficit,
      amount: deficit,
      source: "SISTEMA",
    });
  }

  return items;
}

// --------------------------------------------- Resolução de cenário

export type GoalResolutionAction =
  | { kind: "EXTEND_DEADLINE"; months: number }
  | { kind: "REDUCE_TARGET"; amount: number }
  | { kind: "INCREASE_CONTRIBUTION"; amount: number }
  | { kind: "REDUCE_EXPENSE"; amount: number; category?: string }
  | { kind: "INCREASE_INCOME"; amount: number };

export interface GoalScenario {
  goal: PlanningGoal;
  monthlyCapacity: number;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Aplica uma ação ao cenário e devolve um novo cenário (função pura). */
export function applyResolution(
  scenario: GoalScenario,
  action: GoalResolutionAction,
  now: Date = new Date(),
): GoalScenario {
  const { goal, monthlyCapacity } = scenario;

  switch (action.kind) {
    case "EXTEND_DEADLINE": {
      const base = parseDeadline(goal.deadline) ?? now;
      return {
        monthlyCapacity,
        goal: { ...goal, deadline: toISODate(addMonths(base, action.months)) },
      };
    }
    case "REDUCE_TARGET":
      return {
        monthlyCapacity,
        goal: {
          ...goal,
          targetAmount: Math.max(goal.currentAmount, goal.targetAmount - action.amount),
        },
      };
    case "INCREASE_CONTRIBUTION":
      return {
        monthlyCapacity,
        goal: {
          ...goal,
          monthlyContribution: Math.max(0, goal.monthlyContribution + action.amount),
        },
      };
    case "REDUCE_EXPENSE":
    case "INCREASE_INCOME":
      return {
        monthlyCapacity: Math.max(0, monthlyCapacity + action.amount),
        goal,
      };
    default:
      return scenario;
  }
}

export const RESOLUTION_LABEL: Record<GoalResolutionAction["kind"], string> = {
  EXTEND_DEADLINE: "Aumentar prazo",
  REDUCE_TARGET: "Reduzir o alvo",
  INCREASE_CONTRIBUTION: "Aumentar aporte",
  REDUCE_EXPENSE: "Reduzir gastos",
  INCREASE_INCOME: "Aumentar renda",
};

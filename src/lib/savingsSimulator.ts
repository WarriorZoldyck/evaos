/**
 * Simulador de economia para criação de metas.
 * Funções puras — sem React, sem rede.
 */

export interface SimulatorCategory {
  name: string;
  /** Total gasto no período (ano corrente). */
  total: number;
}

export interface SimulatorCut {
  name: string;
  /** Percentual de corte (0-100). */
  percent: number;
}

export interface SimulatorLine {
  name: string;
  monthlyAvg: number;
  percent: number;
  monthlySaving: number;
}

export interface SimulationResult {
  /** Aporte mensal necessário para bater o alvo no prazo. */
  requiredMonthly: number;
  /** Economia mensal gerada pelos cortes simulados. */
  simulatedMonthly: number;
  /** requiredMonthly - simulatedMonthly (positivo = ainda falta). */
  missingMonthly: number;
  /** simulatedMonthly / requiredMonthly (0..n). */
  coverage: number;
  feasible: boolean;
  lines: SimulatorLine[];
  /** Total acumulado no prazo com a economia simulada. */
  projectedTotal: number;
}

const MONTHS_IN_YEAR = 12;

export function monthlyAverage(total: number, monthsInPeriod = MONTHS_IN_YEAR): number {
  if (monthsInPeriod <= 0) return 0;
  return Math.max(0, total) / monthsInPeriod;
}

export function simulateSavings(params: {
  targetAmount: number;
  months: number;
  categories: SimulatorCategory[];
  cuts: SimulatorCut[];
  monthsInPeriod?: number;
}): SimulationResult {
  const { targetAmount, months, categories, cuts, monthsInPeriod = MONTHS_IN_YEAR } = params;

  const safeMonths = Math.max(1, Math.round(months || 0));
  const requiredMonthly = Math.max(0, targetAmount || 0) / safeMonths;

  const cutMap = new Map(cuts.map((c) => [c.name, clampPercent(c.percent)]));

  const lines: SimulatorLine[] = categories.map((c) => {
    const monthlyAvg = monthlyAverage(c.total, monthsInPeriod);
    const percent = cutMap.get(c.name) ?? 0;
    return {
      name: c.name,
      monthlyAvg,
      percent,
      monthlySaving: (monthlyAvg * percent) / 100,
    };
  });

  const simulatedMonthly = lines.reduce((s, l) => s + l.monthlySaving, 0);
  const missingMonthly = requiredMonthly - simulatedMonthly;
  const coverage = requiredMonthly > 0 ? simulatedMonthly / requiredMonthly : 0;

  return {
    requiredMonthly,
    simulatedMonthly,
    missingMonthly,
    coverage,
    feasible: requiredMonthly > 0 && simulatedMonthly >= requiredMonthly - 0.005,
    lines,
    projectedTotal: simulatedMonthly * safeMonths,
  };
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Data ISO (YYYY-MM-DD) somando N meses à data base. */
export function deadlineFromMonths(months: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setMonth(d.getMonth() + Math.max(1, Math.round(months || 0)));
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const day = String(Math.min(now.getDate(), last)).padStart(2, "0");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${day}`;
}

/**
 * Cálculo determinístico do acompanhamento de uma meta (cofrinho).
 * Sem IA: os números precisam bater exatamente com o que está na tela.
 */

export type GoalInsightStatus = "done" | "on_track" | "slightly_behind" | "off_track" | "no_deadline";

export interface GoalInsightInput {
  id: string;
  name: string;
  target: number;
  current: number;
  /** ISO date (YYYY-MM-DD) ou null quando a meta não tem prazo. */
  deadline: string | null;
}

export interface GoalInsight {
  id: string;
  name: string;
  target: number;
  current: number;
  /** Quanto ainda falta guardar (nunca negativo). */
  remaining: number;
  /** 0 a 100. */
  progressPct: number;
  /** Meses inteiros que faltam até o prazo (mínimo 1 quando há prazo futuro). */
  monthsLeft: number | null;
  /** Aporte mensal necessário para bater a meta no prazo. */
  requiredMonthly: number;
  /** Sobra (positivo) ou déficit (negativo) frente à capacidade mensal. */
  gap: number;
  /** Meses estimados no ritmo atual (null quando a capacidade é zero). */
  monthsAtCurrentPace: number | null;
  status: GoalInsightStatus;
  message: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function monthsUntil(deadline: string, from: Date = new Date()): number {
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m) return 0;
  const target = new Date(y, m - 1, d || 1);
  const months =
    (target.getFullYear() - from.getFullYear()) * 12 + (target.getMonth() - from.getMonth());
  return Math.max(0, months);
}

export function buildGoalInsight(
  goal: GoalInsightInput,
  monthlyCapacity: number,
  now: Date = new Date(),
): GoalInsight {
  const target = Math.max(0, goal.target || 0);
  const current = Math.max(0, goal.current || 0);
  const remaining = round2(Math.max(0, target - current));
  const progressPct = target > 0 ? Math.min(100, round2((current / target) * 100)) : 0;
  const capacity = Math.max(0, round2(monthlyCapacity || 0));

  const monthsLeft = goal.deadline ? Math.max(1, monthsUntil(goal.deadline, now)) : null;
  const requiredMonthly = monthsLeft ? round2(remaining / monthsLeft) : 0;
  const gap = monthsLeft ? round2(capacity - requiredMonthly) : 0;
  const monthsAtCurrentPace =
    capacity > 0 && remaining > 0 ? Math.ceil(remaining / capacity) : remaining <= 0 ? 0 : null;

  let status: GoalInsightStatus;
  let message: string;

  if (remaining <= 0.005) {
    status = "done";
    message = "Meta concluída. Você já alcançou o valor planejado.";
  } else if (!monthsLeft) {
    status = "no_deadline";
    message =
      monthsAtCurrentPace === null
        ? "Sem prazo definido e sem capacidade de aporte na simulação atual."
        : `Sem prazo definido. No ritmo simulado você chega em ${monthsAtCurrentPace} ${
            monthsAtCurrentPace === 1 ? "mês" : "meses"
          }.`;
  } else if (gap >= 0) {
    status = "on_track";
    message = `Dentro do ritmo: sobram ${formatMoney(gap)}/mês além do necessário.`;
  } else if (Math.abs(gap) <= requiredMonthly * 0.2) {
    status = "slightly_behind";
    message = `Levemente atrás: faltam ${formatMoney(Math.abs(gap))}/mês para bater o prazo.`;
  } else {
    status = "off_track";
    message =
      monthsAtCurrentPace === null
        ? `Fora do ritmo: sem capacidade mensal, a meta não avança.`
        : `Fora do ritmo: faltam ${formatMoney(Math.abs(gap))}/mês. No ritmo atual levaria ${monthsAtCurrentPace} ${
            monthsAtCurrentPace === 1 ? "mês" : "meses"
          }.`;
  }

  return {
    id: goal.id,
    name: goal.name,
    target,
    current,
    remaining,
    progressPct,
    monthsLeft,
    requiredMonthly,
    gap,
    monthsAtCurrentPace,
    status,
    message,
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

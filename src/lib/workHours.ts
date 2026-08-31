/**
 * Cálculo puro das horas de trabalho do mês para a Precificação.
 * Sem React, sem rede.
 */

/** 0 = domingo … 6 = sábado (mesma convenção de Date.getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "D",
  1: "S",
  2: "T",
  3: "Q",
  4: "Q",
  5: "S",
  6: "S",
};

export const WEEKDAY_FULL: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const DEFAULT_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

/** Data local em YYYY-MM-DD (sem passar por UTC). */
export const toISODay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Todos os dias do mês (month: 1-12) que caem nos dias da semana escolhidos. */
export function workingDaysOfMonth(
  year: number,
  month: number,
  weekdays: Weekday[],
  excluded: string[] = [],
): string[] {
  if (weekdays.length === 0) return [];
  const set = new Set(weekdays);
  const skip = new Set(excluded);
  const out: string[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    if (!set.has(d.getDay() as Weekday)) continue;
    const iso = toISODay(d);
    if (skip.has(iso)) continue;
    out.push(iso);
  }
  return out;
}

export function countWorkingDays(
  year: number,
  month: number,
  weekdays: Weekday[],
  excluded: string[] = [],
): number {
  return workingDaysOfMonth(year, month, weekdays, excluded).length;
}

/** Horas de agenda disponíveis no mês (antes da perda produtiva). */
export function availableHours(workingDays: number, hoursPerDay: number): number {
  const days = Math.max(0, workingDays);
  const hpd = Math.max(0, hoursPerDay);
  return Math.round(days * hpd * 100) / 100;
}

/** Horas que efetivamente viram serviço faturado. */
export function productiveHours(available: number, lossPct: number): number {
  const base = Math.max(0, available);
  const loss = Math.min(99.99, Math.max(0, lossPct || 0));
  return Math.round(base * (1 - loss / 100) * 100) / 100;
}

export const formatHours = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;

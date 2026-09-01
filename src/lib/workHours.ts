/**
 * Cálculo puro das horas de trabalho do mês para a Precificação.
 * Sem React, sem rede.
 */

import { holidayMap } from "./brazilHolidays";

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

/** Faixa de horário de um dia. `break` em minutos. */
export interface TimeRange {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  break: number; // minutos
}

export const DEFAULT_RANGE: TimeRange = { start: "08:00", end: "18:00", break: 60 };

/** Jornada padrão por dia da semana: chave = weekday (0-6). */
export type WeekdaySchedule = Partial<Record<Weekday, TimeRange>>;

/** Ajustes por data ISO. `null` = folga naquele dia. */
export type DayOverrides = Record<string, TimeRange | null>;

/** Data local em YYYY-MM-DD (sem passar por UTC). */
export const toISODay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Converte ISO (YYYY-MM-DD) para Date local. */
export const fromISODay = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Horas líquidas de uma faixa (fim − início − intervalo), nunca negativo. */
export function dayHours(range: TimeRange | null | undefined): number {
  if (!range) return 0;
  const mins = toMinutes(range.end) - toMinutes(range.start) - (range.break || 0);
  return Math.round(Math.max(0, mins) / 6) / 10;
}

export interface ScheduledDay {
  date: string;
  weekday: Weekday;
  range: TimeRange | null;
  hours: number;
  holidayName?: string;
  /** true quando o usuário sobrescreveu o padrão/feriado nesse dia. */
  overridden: boolean;
}

export interface MonthScheduleOptions {
  weekdaySchedule: WeekdaySchedule;
  overrides?: DayOverrides;
  observeHolidays?: boolean;
}

/** Todos os dias do mês (month: 1-12) com a faixa resolvida. */
export function monthSchedule(
  year: number,
  month: number,
  { weekdaySchedule, overrides = {}, observeHolidays = true }: MonthScheduleOptions,
): ScheduledDay[] {
  const holidays = holidayMap(year);
  const lastDay = new Date(year, month, 0).getDate();
  const out: ScheduledDay[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    const date = toISODay(d);
    const weekday = d.getDay() as Weekday;
    const holidayName = holidays[date];
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, date);

    let range: TimeRange | null;
    if (hasOverride) {
      range = overrides[date];
    } else if (observeHolidays && holidayName) {
      range = null;
    } else {
      range = weekdaySchedule[weekday] ?? null;
    }

    out.push({
      date,
      weekday,
      range,
      hours: dayHours(range),
      holidayName,
      overridden: hasOverride,
    });
  }
  return out;
}

/** Dias que efetivamente somam horas. */
export function workingDaysFromSchedule(days: ScheduledDay[]): ScheduledDay[] {
  return days.filter((d) => d.hours > 0);
}

/** Horas disponíveis do mês a partir da agenda resolvida. */
export function availableHoursFromSchedule(days: ScheduledDay[]): number {
  return Math.round(days.reduce((s, d) => s + d.hours, 0) * 100) / 100;
}

// ─── Compatibilidade com o formato antigo (weekdays + horas/dia) ───

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
    const isoDate = toISODay(d);
    if (skip.has(isoDate)) continue;
    out.push(isoDate);
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

/** Converte o formato antigo em um `WeekdaySchedule`. */
export function legacyToWeekdaySchedule(
  weekdays: Weekday[],
  hoursPerDay: number | null,
): WeekdaySchedule {
  if (weekdays.length === 0 || !hoursPerDay || hoursPerDay <= 0) return {};
  const startMin = 8 * 60;
  const endMin = startMin + Math.round(hoursPerDay * 60);
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: WeekdaySchedule = {};
  for (const w of weekdays) out[w] = { start: fmt(startMin), end: fmt(endMin), break: 0 };
  return out;
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

/** "YYYY-MM" a partir de ano/mês. */
export const toMonthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export const parseMonthKey = (key: string | null | undefined): { year: number; month: number } | null => {
  if (!key) return null;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, month: m };
};

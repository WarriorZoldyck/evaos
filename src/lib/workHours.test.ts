import { describe, it, expect } from "vitest";
import {
  countWorkingDays,
  workingDaysOfMonth,
  availableHours,
  productiveHours,
  DEFAULT_WEEKDAYS,
  dayHours,
  monthSchedule,
  availableHoursFromSchedule,
  DEFAULT_RANGE,
} from "./workHours";

const R = DEFAULT_RANGE;

describe("workHours", () => {
  it("conta os dias úteis reais do mês", () => {
    // Setembro/2026: 1º é uma terça; 22 dias de seg a sex.
    expect(countWorkingDays(2026, 9, DEFAULT_WEEKDAYS)).toBe(22);
    // Fevereiro/2026 (28 dias, começa domingo): 20 dias úteis.
    expect(countWorkingDays(2026, 2, DEFAULT_WEEKDAYS)).toBe(20);
  });

  it("desconta os dias excluídos (feriados/folgas)", () => {
    const dias = workingDaysOfMonth(2026, 9, DEFAULT_WEEKDAYS, ["2026-09-07"]);
    expect(dias).toHaveLength(21);
    expect(dias).not.toContain("2026-09-07");
  });

  it("ignora dias excluídos que não estavam na contagem", () => {
    // 2026-09-05 é sábado, não entra na lista de seg-sex.
    expect(countWorkingDays(2026, 9, DEFAULT_WEEKDAYS, ["2026-09-05"])).toBe(22);
  });

  it("sem dias da semana selecionados não há horas", () => {
    expect(countWorkingDays(2026, 9, [])).toBe(0);
  });

  it("calcula horas disponíveis e produtivas", () => {
    expect(availableHours(22, 8)).toBe(176);
    expect(productiveHours(176, 0)).toBe(176);
    expect(productiveHours(176, 25)).toBe(132);
    expect(productiveHours(176, -5)).toBe(176);
  });
});

describe("workHours — agenda com faixa horária", () => {
  const sched = { 1: R, 2: R, 3: R, 4: R, 5: R } as const;

  it("calcula as horas de uma faixa descontando o intervalo", () => {
    expect(dayHours({ start: "08:00", end: "18:00", break: 60 })).toBe(9);
    expect(dayHours({ start: "08:00", end: "12:00", break: 0 })).toBe(4);
    expect(dayHours(null)).toBe(0);
  });

  it("marca feriados nacionais como folga por padrão", () => {
    const days = monthSchedule(2026, 9, { weekdaySchedule: sched });
    const sete = days.find((d) => d.date === "2026-09-07");
    expect(sete?.hours).toBe(0);
    expect(sete?.holidayName).toBe("Independência do Brasil");
    // 22 dias úteis − 1 feriado = 21 × 9h
    expect(availableHoursFromSchedule(days)).toBe(21 * 9);
  });

  it("respeita overrides de dia (folga e horário custom)", () => {
    const days = monthSchedule(2026, 9, {
      weekdaySchedule: sched,
      overrides: { "2026-09-07": R, "2026-09-08": { start: "08:00", end: "12:00", break: 0 } },
    });
    expect(availableHoursFromSchedule(days)).toBe(21 * 9 + 9 - 9 + 4);
  });
});

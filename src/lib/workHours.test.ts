import { describe, it, expect } from "vitest";
import {
  countWorkingDays,
  workingDaysOfMonth,
  availableHours,
  productiveHours,
  DEFAULT_WEEKDAYS,
} from "./workHours";

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

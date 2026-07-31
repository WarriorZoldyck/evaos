import { describe, it, expect } from "vitest";
import {
  getCreditCardDueDate,
  buildInstallmentDates,
} from "@/lib/creditCardDueDate";

describe("buildInstallmentDates", () => {
  it("ancora a 1ª parcela na data de pagamento informada (competência antiga + pagamento futuro)", () => {
    // Caso reportado: competência 2025-09-07, pagamento 2026-07-10, 3x
    const dates = buildInstallmentDates("2026-07-10", 3);
    expect(dates).toEqual(["2026-07-10", "2026-08-10", "2026-09-10"]);
  });

  it("respeita datas editadas manualmente", () => {
    const dates = buildInstallmentDates("2026-07-10", 3, {
      customDates: { 2: "2026-08-25" },
    });
    expect(dates).toEqual(["2026-07-10", "2026-08-25", "2026-09-10"]);
  });

  it("suporta intervalo em dias corridos", () => {
    const dates = buildInstallmentDates("2026-01-01", 3, {
      intervalType: "custom_days",
      customDays: 15,
    });
    expect(dates).toEqual(["2026-01-01", "2026-01-16", "2026-01-31"]);
  });

  it("faz clamp do dia em meses curtos", () => {
    const dates = buildInstallmentDates("2026-01-31", 3);
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("vira o ano corretamente", () => {
    const dates = buildInstallmentDates("2026-11-10", 3);
    expect(dates).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
  });

  it("caso normal: âncora vinda do ciclo do cartão", () => {
    // Compra em 05/03, fechamento dia 25, vencimento dia 5 → fatura de abril
    const anchor = getCreditCardDueDate("2026-03-05", 25, 5);
    const dates = buildInstallmentDates(anchor, 3);
    expect(dates[0]).toBe(anchor);
    expect(dates).toEqual([anchor, "2026-05-05", "2026-06-05"]);
  });
});

import { describe, it, expect } from "vitest";
import {
  priceFactor,
  computeInstallmentRow,
  buildInstallmentPlan,
} from "./installmentPricing";

const base = { netTarget: 1500, acquirerRatePercent: 0, monthlyInterestPercent: 0 };

describe("priceFactor", () => {
  it("divide igualmente sem juros", () => {
    expect(priceFactor(0, 10)).toBeCloseTo(0.1, 10);
  });
  it("usa Price com juros", () => {
    expect(priceFactor(0.02, 12)).toBeCloseTo(0.0945596, 6);
  });
});

describe("computeInstallmentRow", () => {
  it("à vista sem taxa é o próprio valor", () => {
    const r = computeInstallmentRow(base, 1)!;
    expect(r.installmentAmount).toBe(1500);
    expect(r.netReceived).toBe(1500);
    expect(r.surcharge).toBe(0);
  });

  it("aplica taxa da maquininha no bruto", () => {
    const r = computeInstallmentRow({ ...base, acquirerRatePercent: 3.33 }, 1)!;
    expect(r.totalCharged).toBeCloseTo(1551.7, 1);
    expect(r.netReceived).toBeCloseTo(1500, 0);
  });

  it("aplica juro mensal no parcelamento", () => {
    const r = computeInstallmentRow({ ...base, monthlyInterestPercent: 2 }, 12)!;
    expect(r.installmentAmount).toBeCloseTo(141.84, 1);
    expect(r.totalCharged).toBeGreaterThan(1500);
  });

  it("combina taxa e juro", () => {
    const r = computeInstallmentRow(
      { netTarget: 1500, acquirerRatePercent: 3, monthlyInterestPercent: 2 },
      6,
    )!;
    expect(r.netReceived).toBeGreaterThan(1500);
    expect(r.surchargePercent).toBeGreaterThan(0);
  });

  it("rejeita valores inválidos", () => {
    expect(computeInstallmentRow({ ...base, netTarget: 0 }, 3)).toBeNull();
    expect(computeInstallmentRow({ ...base, acquirerRatePercent: 100 }, 3)).toBeNull();
    expect(computeInstallmentRow(base, 0)).toBeNull();
  });
});

describe("buildInstallmentPlan", () => {
  it("gera de 1 a N parcelas", () => {
    const rows = buildInstallmentPlan({ ...base, maxInstallments: 21 });
    expect(rows).toHaveLength(21);
    expect(rows[0].installments).toBe(1);
    expect(rows[20].installments).toBe(21);
  });

  it("limita a 48 parcelas", () => {
    expect(buildInstallmentPlan({ ...base, maxInstallments: 200 })).toHaveLength(48);
  });
});

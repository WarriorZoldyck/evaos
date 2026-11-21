import { describe, expect, it } from "vitest";
import {
  installmentSplitsRemaining,
  parseFlexibleAccount,
  validateInstallmentSplits,
} from "./installmentPaymentSplits";

describe("installmentPaymentSplits", () => {
  it("parses bank, wallet, card, and empty accounts", () => {
    expect(parseFlexibleAccount("bank:b1")).toEqual({
      bank_account_id: "b1",
      wallet_id: null,
      credit_card_id: null,
    });
    expect(parseFlexibleAccount("wallet:w1")).toEqual({
      bank_account_id: null,
      wallet_id: "w1",
      credit_card_id: null,
    });
    expect(parseFlexibleAccount("card:c1")).toEqual({
      bank_account_id: null,
      wallet_id: null,
      credit_card_id: "c1",
    });
    expect(parseFlexibleAccount("")).toEqual({
      bank_account_id: null,
      wallet_id: null,
      credit_card_id: null,
    });
  });

  it("validates mixed payment splits within a single installment", () => {
    expect(
      validateInstallmentSplits(1000, [
        { method: "Cartão de Crédito", account: "card:c1", amount: 400 },
        { method: "Boleto", account: "bank:b1", amount: 600 },
      ]),
    ).toBeNull();

    expect(
      validateInstallmentSplits(1000, [
        { method: "Cartão de Crédito", account: "card:c1", amount: 400 },
        { method: "Cheque", account: "", amount: 500 },
      ]),
    ).not.toBeNull();

    expect(
      installmentSplitsRemaining(1000, [
        { method: "Cartão de Crédito", account: "card:c1", amount: 350.25 },
      ]),
    ).toBe(649.75);
  });
});


import { validateInstallmentSplits as vSplit } from "./installmentPaymentSplits";
describe("parcela com várias formas de pagamento", () => {
  it("aceita boleto com conta + dinheiro com carteira", () => {
    expect(vSplit(960, [
      { method: "Boleto", account: "bank:b1", amount: 500 },
      { method: "Dinheiro", account: "wallet:w1", amount: 460 },
    ] as any)).toBeNull();
  });
  it("rejeita boleto sem conta", () => {
    expect(vSplit(960, [{ method: "Boleto", account: "", amount: 960 }] as any)).not.toBeNull();
  });
  it("rejeita dinheiro sem carteira", () => {
    expect(vSplit(960, [{ method: "Dinheiro", account: "bank:b1", amount: 960 }] as any)).not.toBeNull();
  });
});

import { computeTerminalBatchReceivables, terminalReceivable as _tr, validateInstallmentSplits as _vs } from "./installmentPaymentSplits";
describe("cartão combinado com maquininha", () => {
  const term = { debit_rate: 1.5, credit_rate: 3.19, settlement_days_debit: 1, settlement_days_credit: 30, rates_info: JSON.stringify([{ installments: 3, rate: 5 }]) };
  const termAntecipado = { debit_rate: 1.5, credit_rate: 3.19, settlement_days_debit: 1, settlement_days_credit: 1, rates_info: JSON.stringify([{ installments: 10, rate: 10 }]) };
  it("8.000 em 3x usa taxa de 3x e cai mês a mês", () => {
    const sale = new Date(2026, 11, 20);
    const r = [0, 1, 2].map((i) => _tr({ terminal: term, method: "Cartão de Crédito", gross: 2666.67, cardCount: 3, indexInCard: i, saleDate: sale }));
    expect(r[0].rate).toBe(5);
    expect(r[0].net).toBe(2533.34);
    expect(r.map((x) => x.paymentDate.getMonth())).toEqual([0, 1, 2]);
  });
  it("cartão antecipado (D+1) em múltiplas modalidades consolida em 1 único recebível líquido", () => {
    const sale = new Date(2026, 10, 24);
    const batch = computeTerminalBatchReceivables({
      terminal: termAntecipado,
      method: "Cartão de Crédito",
      grossParts: Array(10).fill(500),
      saleDate: sale,
    });
    expect(batch.isLumpSum).toBe(true);
    expect(batch.rate).toBe(10);
    expect(batch.totalGross).toBe(5000);
    expect(batch.totalFee).toBe(500);
    expect(batch.totalNet).toBe(4500);
    expect(batch.paymentDate).toEqual(new Date(2026, 10, 25));
  });
  it("cartão sem antecipação (D+30) em múltiplas modalidades cai mês a mês em datas diferentes", () => {
    const sale = new Date(2026, 10, 24);
    const batch = computeTerminalBatchReceivables({
      terminal: term,
      method: "Cartão de Crédito",
      grossParts: [1000, 1000, 1000],
      saleDate: sale,
    });
    expect(batch.isLumpSum).toBe(false);
    expect(batch.items.map((i) => i.paymentDate.getMonth())).toEqual([11, 0, 1]);
    expect(batch.items.every((i) => i.net === 950)).toBe(true);
  });
  it("cartão sem maquininha bloqueia", () => {
    expect(_vs(100, [{ method: "Cartão de Crédito", account: "", amount: 100 }])).toBe("Escolha a maquininha do cartão.");
    expect(_vs(100, [{ method: "Cartão de Crédito", account: "terminal:x", amount: 100 }])).toBeNull();
  });
});

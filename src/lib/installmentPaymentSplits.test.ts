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
        { method: "Boleto", account: "", amount: 600 },
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


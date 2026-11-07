import { describe, it, expect } from "vitest";
import { validateSplits, splitsRemaining, parseAccount } from "./paymentSplit";

describe("paymentSplit", () => {
  it("aceita dinheiro + cartão somando o valor final (500 + 460 = 960)", () => {
    expect(validateSplits(960, [
      { method: "Dinheiro", account: "wallet:w1", amount: 500 },
      { method: "Cartão de Crédito", account: "bank:b1", amount: 460 },
    ])).toBeNull();
  });
  it("bloqueia quando a soma não bate com o valor final", () => {
    expect(splitsRemaining(960, [{ method: "Dinheiro", account: "wallet:w1", amount: 500 }])).toBe(460);
    expect(validateSplits(960, [{ method: "Dinheiro", account: "wallet:w1", amount: 500 }])).not.toBeNull();
  });
  it("exige conta ou carteira em cada parte", () => {
    expect(validateSplits(960, [{ method: "Dinheiro", account: "", amount: 960 }])).not.toBeNull();
  });
  it("carteira grava wallet_id e zera conta bancária", () => {
    expect(parseAccount("wallet:w1")).toEqual({ bank_account_id: null, wallet_id: "w1" });
  });
});

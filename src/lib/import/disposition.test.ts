import { describe, it, expect } from "vitest";
import { effectiveAction, rowDisposition, type RowAction } from "./disposition";

/**
 * Regressão do bug "16 mil sumiram": ao recalcular a conciliação, as decisões
 * do usuário não podem ser sobrescritas, e uma linha confirmada na tela nunca
 * pode virar "ignorar" no salvamento.
 */
function applyMatchDefaults(
  prev: Record<number, RowAction>,
  decided: Set<number>,
  defaults: Record<number, RowAction>,
): Record<number, RowAction> {
  const merged = { ...defaults };
  for (const key of Object.keys(prev)) {
    const i = Number(key);
    if (decided.has(i)) merged[i] = prev[i];
  }
  return merged;
}

describe("decisão da linha na conciliação", () => {
  it("linha confirmada na tela conta como 'criar' mesmo sem ação registrada", () => {
    expect(effectiveAction(undefined, true)).toBe("criar");
    expect(rowDisposition(undefined, false, true)).toBe("create");
  });

  it("linha sem decisão e sem confirmação é ignorada", () => {
    expect(effectiveAction(undefined, false)).toBe("ignorar");
    expect(rowDisposition(undefined, false, false)).toBe("ignore-explicit");
  });

  it("recálculo do matcher preserva as decisões do usuário", () => {
    const prev: Record<number, RowAction> = { 0: "criar", 1: "criar", 2: "vincular" };
    const decided = new Set([0, 1, 2]);
    // Matcher roda de novo e, sem par, nasceria tudo como "ignorar".
    const defaults: Record<number, RowAction> = { 0: "ignorar", 1: "ignorar", 2: "ignorar", 3: "ignorar" };

    const merged = applyMatchDefaults(prev, decided, defaults);

    expect(merged[0]).toBe("criar");
    expect(merged[1]).toBe("criar");
    expect(merged[2]).toBe("vincular");
    expect(merged[3]).toBe("ignorar"); // linha nova, sem decisão

    const toImport = Object.values(merged).filter((a) => a !== "ignorar").length;
    expect(toImport).toBe(3);
  });
});

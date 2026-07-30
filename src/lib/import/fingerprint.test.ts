import { describe, it, expect } from "vitest";
import { buildImportFingerprint, normalizeDescriptionForFingerprint } from "./fingerprint";

describe("normalizeDescriptionForFingerprint", () => {
  it("remove acentos, pontuação e espaços duplicados", () => {
    expect(normalizeDescriptionForFingerprint("  Pix   enviado - JOÃO da Silva!! ")).toBe(
      "PIX ENVIADO JOAO DA SILVA",
    );
  });

  it("é estável para variações de caixa/espaço", () => {
    expect(normalizeDescriptionForFingerprint("tarifa  MENSAL")).toBe(
      normalizeDescriptionForFingerprint("Tarifa Mensal"),
    );
  });
});

describe("buildImportFingerprint", () => {
  const base = {
    accountKey: "bank:abc",
    date: "2026-01-05",
    amount: 1613.37,
    type: "despesa",
    description: "PIX ENVIADO",
  };

  it("gera a mesma chave para a mesma linha", () => {
    expect(buildImportFingerprint(base)).toBe(
      buildImportFingerprint({ ...base, amount: -1613.37, description: "pix  enviado" }),
    );
  });

  it("muda quando valor, data, tipo ou conta mudam", () => {
    const fp = buildImportFingerprint(base);
    expect(buildImportFingerprint({ ...base, amount: 1613.38 })).not.toBe(fp);
    expect(buildImportFingerprint({ ...base, date: "2026-01-06" })).not.toBe(fp);
    expect(buildImportFingerprint({ ...base, type: "receita" })).not.toBe(fp);
    expect(buildImportFingerprint({ ...base, accountKey: "wallet:abc" })).not.toBe(fp);
  });

  it("formata o valor com duas casas", () => {
    expect(buildImportFingerprint({ ...base, amount: 84 })).toContain("|84.00|");
  });
});

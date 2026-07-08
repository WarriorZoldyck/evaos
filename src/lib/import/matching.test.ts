import { describe, it, expect } from "vitest";
import { scoreCandidate, pickBestMatch, type CandidateTx } from "@/lib/import/matching";

const baseCand: CandidateTx = {
  id: "c1",
  description: "Aluguel Junho",
  amount: 3500,
  payment_date: "2026-06-05",
  type: "despesa",
  status: "Pendente",
  category: "Moradia",
  contact_name: "Imobiliária X",
  series_id: null,
  installment_number: null,
  installments_total: null,
};

describe("scoreCandidate", () => {
  it("matches when value and type match within window", () => {
    const r = scoreCandidate(
      { date: "2026-06-05", description: "ALUGUEL IMOBILIARIA X", amount: 3500, type: "despesa" },
      baseCand
    );
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThanOrEqual(60);
  });

  it("rejects different type", () => {
    expect(
      scoreCandidate(
        { date: "2026-06-05", description: "X", amount: 3500, type: "receita" },
        baseCand
      )
    ).toBeNull();
  });

  it("rejects different value", () => {
    expect(
      scoreCandidate(
        { date: "2026-06-05", description: "X", amount: 3501, type: "despesa" },
        baseCand
      )
    ).toBeNull();
  });

  it("rejects beyond date window", () => {
    expect(
      scoreCandidate(
        { date: "2026-07-01", description: "X", amount: 3500, type: "despesa" },
        baseCand
      )
    ).toBeNull();
  });
});

describe("pickBestMatch", () => {
  it("returns null when no candidates fit", () => {
    expect(
      pickBestMatch(
        { date: "2026-06-05", description: "X", amount: 3500, type: "receita" },
        [baseCand]
      )
    ).toBeNull();
  });

  it("picks higher-score candidate", () => {
    const c2: CandidateTx = { ...baseCand, id: "c2", payment_date: "2026-06-08" };
    const r = pickBestMatch(
      { date: "2026-06-05", description: "ALUGUEL", amount: 3500, type: "despesa" },
      [c2, baseCand]
    );
    expect(r!.candidate.id).toBe("c1"); // exact day match wins
  });

  it("auto-links on strong trio (same day + exact value + contact) even with unrelated description", () => {
    const cand: CandidateTx = {
      ...baseCand,
      id: "cs",
      description: "Sorvete família",
      amount: 25,
      payment_date: "2026-06-06",
      contact_name: "Italyan Sorvetes",
      category: "Alimentação",
    };
    const r = pickBestMatch(
      { date: "2026-06-06", description: "ItalyanSorvetes", amount: 25, type: "despesa" },
      [cand]
    );
    expect(r).not.toBeNull();
    expect(r!.candidate.id).toBe("cs");
  });

  it("does NOT auto-link when trio is incomplete (no contact match, low similarity)", () => {
    const cand: CandidateTx = {
      ...baseCand,
      id: "cx",
      description: "Compra genérica",
      amount: 25,
      payment_date: "2026-06-06",
      contact_name: "Outra Loja",
      category: null,
    };
    const r = pickBestMatch(
      { date: "2026-06-06", description: "ItalyanSorvetes", amount: 25, type: "despesa" },
      [cand]
    );
    // Novo comportamento: valor+data batem, único candidato → devolve como "sugerido"
    expect(r).not.toBeNull();
    expect(r!.suggested).toBe(true);
  });

  it("does NOT suggest when two candidates share the same amount (ambiguous)", () => {
    const c1: CandidateTx = { ...baseCand, id: "a", amount: 25, payment_date: "2026-06-06", description: "X", contact_name: "A", category: null };
    const c2: CandidateTx = { ...baseCand, id: "b", amount: 25, payment_date: "2026-06-07", description: "Y", contact_name: "B", category: null };
    const r = pickBestMatch(
      { date: "2026-06-06", description: "ItalyanSorvetes", amount: 25, type: "despesa" },
      [c1, c2]
    );
    expect(r).toBeNull();
  });

  it("does NOT suggest a July card transaction for a June statement purchase", () => {
    const julyCand: CandidateTx = {
      ...baseCand,
      id: "jul",
      amount: 153.9,
      payment_date: "2026-07-10",
      competence_date: "2026-07-10",
      purchase_date_original: "2026-07-04",
      description: "Compra futura",
      contact_name: null,
      category: null,
    };
    const r = pickBestMatch(
      { date: "2026-06-12", description: "AZUL COMPRA", amount: 153.9, type: "despesa" },
      [julyCand],
      { useCompetenceDate: true, dayWindow: 3 }
    );
    expect(r).toBeNull();
  it("still scores a paid May candidate (scope filter lives in the hook)", () => {
    const paidMay: CandidateTx = {
      ...baseCand,
      id: "may",
      amount: 118,
      payment_date: "2026-05-09",
      competence_date: "2026-05-01",
      purchase_date_original: "2026-05-01",
      status: "Pago",
    };
    // scoreCandidate itself doesn't know about statement scope; the hook filters.
    const r = scoreCandidate(
      { date: "2026-05-02", description: "Chat GPT", amount: 118, type: "despesa" },
      paidMay,
      { useCompetenceDate: true, dayWindow: 3 }
    );
    expect(r).not.toBeNull();
  });
});


  it("suggests a manual June card purchase with same value inside statement scope", () => {
    const juneManual: CandidateTx = {
      ...baseCand,
      id: "jun",
      amount: 153.9,
      payment_date: "2026-06-20",
      competence_date: "2026-06-13",
      purchase_date_original: null,
      description: "Lançamento manual",
      contact_name: null,
      category: null,
    };
    const r = pickBestMatch(
      { date: "2026-06-12", description: "AZUL COMPRA", amount: 153.9, type: "despesa" },
      [juneManual],
      { useCompetenceDate: true, dayWindow: 3 }
    );
    expect(r).not.toBeNull();
    expect(r!.suggested).toBe(true);
    expect(r!.candidate.id).toBe("jun");
  });
});



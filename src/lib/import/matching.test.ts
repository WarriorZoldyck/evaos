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
});

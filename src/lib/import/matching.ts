/**
 * Pure functions to score and pick candidates when matching a statement line
 * against an existing pending transaction in the database.
 *
 * v1 scope: real Pendente transactions only (no projected recurrences).
 */

export interface StatementLine {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "receita" | "despesa";
}

export interface CandidateTx {
  id: string;
  description: string;
  amount: number;
  payment_date: string;
  type: "receita" | "despesa";
  status: string;
  category: string | null;
  contact_name: string | null;
  series_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
}

export interface ScoredCandidate {
  candidate: CandidateTx;
  score: number;
  dayDiff: number;
}

/** Tolerance window (days) for matching by date. */
export const DATE_WINDOW_DAYS = 7;

function diffDays(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round(Math.abs(a - b) / (1000 * 60 * 60 * 24));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 4)
  );
}

function sharesToken(a: string, b: string): boolean {
  const ta = tokens(a);
  if (ta.size === 0) return false;
  const tb = tokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

/** Returns score >= 0 for a candidate; 0 means not a match. */
export function scoreCandidate(line: StatementLine, c: CandidateTx): ScoredCandidate | null {
  // Hard requirements
  if (c.type !== line.type) return null;
  if (Math.abs(c.amount - Math.abs(line.amount)) > 0.005) return null;
  const dayDiff = diffDays(line.date, c.payment_date);
  if (dayDiff > DATE_WINDOW_DAYS) return null;

  let score = 40; // value exact

  if (dayDiff === 0) score += 20;
  else if (dayDiff <= 3) score += 10;
  else score += 5;

  if (c.contact_name && sharesToken(line.description, c.contact_name)) score += 15;
  if (sharesToken(line.description, c.description)) score += 10;

  return { candidate: c, score, dayDiff };
}

/** Picks the best candidate, ties broken by smallest dayDiff. */
export function pickBestMatch(
  line: StatementLine,
  candidates: CandidateTx[]
): ScoredCandidate | null {
  const scored = candidates
    .map((c) => scoreCandidate(line, c))
    .filter((s): s is ScoredCandidate => s !== null)
    .sort((a, b) => b.score - a.score || a.dayDiff - b.dayDiff);
  return scored[0] ?? null;
}

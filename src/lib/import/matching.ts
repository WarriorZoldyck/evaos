/**
 * Pure functions to score and pick candidates when matching a statement line
 * against an existing pending transaction in the database.
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
  competence_date?: string | null;
  type: "receita" | "despesa";
  status: string;
  category: string | null;
  contact_name: string | null;
  series_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
  credit_card_id?: string | null;
}

export interface ScoredCandidate {
  candidate: CandidateTx;
  score: number;
  dayDiff: number;
}

/** Tolerance window (days) for matching by date — debit accounts. */
export const DATE_WINDOW_DAYS = 7;
/** Wider tolerance for credit cards (purchase date may drift days from manual entry). */
export const CARD_DATE_WINDOW_DAYS = 31;
/** Currency tolerance — covers 1-cent rounding between statement and manual entry. */
export const AMOUNT_TOLERANCE = 0.02;

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

export interface ScoreOptions {
  /** When true, prefer matching against candidate.competence_date instead of payment_date. */
  useCompetenceDate?: boolean;
  /** Override the day window (defaults to DATE_WINDOW_DAYS). */
  dayWindow?: number;
}

/** Returns score >= 0 for a candidate; null means not a match. */
export function scoreCandidate(
  line: StatementLine,
  c: CandidateTx,
  opts: ScoreOptions = {},
): ScoredCandidate | null {
  if (c.type !== line.type) return null;
  if (Math.abs(c.amount - Math.abs(line.amount)) > AMOUNT_TOLERANCE) return null;

  const candidateDate = opts.useCompetenceDate
    ? (c.competence_date || c.payment_date)
    : c.payment_date;
  const window = opts.dayWindow ?? DATE_WINDOW_DAYS;
  const dayDiff = diffDays(line.date, candidateDate);
  if (dayDiff > window) return null;

  let score = 40;
  if (dayDiff === 0) score += 20;
  else if (dayDiff <= 3) score += 10;
  else if (dayDiff <= 7) score += 5;

  if (c.contact_name && sharesToken(line.description, c.contact_name)) score += 15;
  if (sharesToken(line.description, c.description)) score += 10;

  return { candidate: c, score, dayDiff };
}

/** Picks the best candidate, ties broken by smallest dayDiff. */
export function pickBestMatch(
  line: StatementLine,
  candidates: CandidateTx[],
  opts: ScoreOptions = {},
): ScoredCandidate | null {
  const scored = candidates
    .map((c) => scoreCandidate(line, c, opts))
    .filter((s): s is ScoredCandidate => s !== null)
    .sort((a, b) => b.score - a.score || a.dayDiff - b.dayDiff);
  return scored[0] ?? null;
}

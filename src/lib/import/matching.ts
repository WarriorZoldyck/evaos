/**
 * Pure functions to score and pick candidates when matching a statement line
 * against an existing pending transaction in the database.
 */

export interface StatementLine {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "receita" | "despesa";
  /** Installment number parsed from the statement description (e.g. "V03/12" → 3). */
  installment_number?: number | null;
  /** Total installments parsed from the statement description (e.g. "V03/12" → 12). */
  installments_total?: number | null;
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
  /** Token-overlap similarity 0..1 between line and candidate descriptions. */
  similarity: number;
  /** Absolute amount difference (line.amount - candidate.amount). */
  amountDiff: number;
  /**
   * Quality tier of the value match:
   * - "exact"     → |Δ| ≤ EXACT_AMOUNT_TOLERANCE (effectively equal)
   * - "tolerance" → EXACT_AMOUNT_TOLERANCE < |Δ| ≤ AMOUNT_TOLERANCE (cent-level diff)
   */
  tier: "exact" | "tolerance";
}

/** Tolerance window (days) for matching by date — debit accounts. */
export const DATE_WINDOW_DAYS = 7;
/**
 * Tolerance window (days) for matching by date — credit cards.
 * Kept tight so we NEVER cross billing cycles. A purchase on the statement
 * must match a system transaction within the same cycle, not the previous month.
 */
export const CARD_DATE_WINDOW_DAYS = 5;
/** Amount considered effectively identical — only float rounding. */
export const EXACT_AMOUNT_TOLERANCE = 0.005;
/** Currency tolerance — covers small differences like discounts/juros up to 5 centavos. */
export const AMOUNT_TOLERANCE = 0.05;

/**
 * Minimum description similarity (0..1) required to AUTO-LINK a candidate.
 * Below this, the candidate may still be shown as a suggestion but must not
 * be auto-selected — this prevents silent links across unrelated descriptions
 * that happen to share value and date (the Sabrina/Renato ghost case).
 */
export const AUTO_LINK_MIN_SIMILARITY = 0.34;

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

/**
 * Jaccard-like similarity over normalized tokens (length ≥ 3).
 * Returns 0..1. Empty token sets return 0.
 */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter((t) => t.length >= 3));
  const tb = new Set(normalize(b).split(" ").filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ScoreOptions {
  /** When true, prefer matching against candidate.competence_date instead of payment_date. */
  useCompetenceDate?: boolean;
  /** Override the day window (defaults to DATE_WINDOW_DAYS). */
  dayWindow?: number;
  /** Optional installment number of the statement line (for strict matching). */
  lineInstallmentNumber?: number | null;
  /** Optional installment total of the statement line (for strict matching). */
  lineInstallmentsTotal?: number | null;
}

/** Returns score >= 0 for a candidate; null means not a match. */
export function scoreCandidate(
  line: StatementLine,
  c: CandidateTx,
  opts: ScoreOptions = {},
): ScoredCandidate | null {
  if (c.type !== line.type) return null;
  if (Math.abs(c.amount - Math.abs(line.amount)) > AMOUNT_TOLERANCE) return null;

  // Strict installment guard: if BOTH sides declare installment numbers and they differ,
  // it is NOT the same purchase (e.g. statement "V03/12" must not match system "V02/12").
  const lineN = opts.lineInstallmentNumber ?? null;
  const lineT = opts.lineInstallmentsTotal ?? null;
  if (lineN != null && c.installment_number != null && lineN !== c.installment_number) return null;
  if (lineT != null && c.installments_total != null && lineT !== c.installments_total) return null;


  const candidateDate = opts.useCompetenceDate
    ? (c.competence_date || c.payment_date)
    : c.payment_date;
  const window = opts.dayWindow ?? DATE_WINDOW_DAYS;
  const dayDiff = diffDays(line.date, candidateDate);
  if (dayDiff > window) return null;

  const similarity = descriptionSimilarity(line.description, c.description);
  const contactSim = c.contact_name
    ? descriptionSimilarity(line.description, c.contact_name)
    : 0;
  const bestSim = Math.max(similarity, contactSim);

  let score = 40;
  if (dayDiff === 0) score += 20;
  else if (dayDiff <= 3) score += 10;
  else if (dayDiff <= 7) score += 5;

  if (c.contact_name && sharesToken(line.description, c.contact_name)) score += 15;
  if (sharesToken(line.description, c.description)) score += 10;
  score += Math.round(bestSim * 30);

  const amountDiff = Math.abs(c.amount - Math.abs(line.amount));
  const tier: "exact" | "tolerance" = amountDiff <= EXACT_AMOUNT_TOLERANCE ? "exact" : "tolerance";

  return { candidate: c, score, dayDiff, similarity: bestSim, amountDiff, tier };
}


/**
 * Picks the best candidate, ties broken by smallest dayDiff.
 * Only returns a match when the description similarity passes
 * `AUTO_LINK_MIN_SIMILARITY` — otherwise returns null so the UI defaults
 * to "create new" instead of silently linking unrelated rows.
 */
export function pickBestMatch(
  line: StatementLine,
  candidates: CandidateTx[],
  opts: ScoreOptions = {},
): ScoredCandidate | null {
  const scored = candidates
    .map((c) => scoreCandidate(line, c, opts))
    .filter((s): s is ScoredCandidate => s !== null)
    .sort((a, b) => b.score - a.score || a.dayDiff - b.dayDiff);
  const top = scored[0];
  if (!top) return null;
  if (top.similarity < AUTO_LINK_MIN_SIMILARITY) return null;
  return top;
}

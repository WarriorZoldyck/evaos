import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export type SuggestionLayer = "exact" | "prefix" | "merchant" | "token";

export interface MatchedSample {
  description: string;
  payment_date: string;
  amount: number | null;
  categoryPath: string;
}

export interface SuggestionSource {
  category: string;
  source: "history" | "ai";
  confidence?: number;
  subcategory?: string;
  subcategory2?: string;
  /** Which matching layer produced this suggestion. */
  layer?: SuggestionLayer;
  /** Normalized description used for the search (audit trail). */
  normalizedQuery?: string;
  /** Up to 3 historical rows that justified this suggestion. */
  matchedSamples?: MatchedSample[];
  /** How many historical entries agreed with the chosen category. */
  voteCount?: number;
  /** Total historical candidates considered before the vote. */
  candidateCount?: number;
}


interface NewRowInput {
  index: number;
  description: string;
  type: "receita" | "despesa";
  amount: number;
}

// ---- Text normalization / merchant fingerprinting ----

const STOPWORDS = new Set([
  "pagamento", "compra", "debito", "credito", "transf", "transferencia",
  "pix", "tef", "boleto", "fatura", "parc", "parcela", "parcelado",
  "mensal", "anual", "taxa", "tarifa", "saque", "deposito", "iof",
  "estorno", "reembolso", "cobranca", "cobrança", "recebimento",
  "compras", "pagto", "pgto", "cred", "deb",
  // months
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
  "janeiro", "fevereiro", "marco", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoise(s: string): string {
  return normalize(s)
    // strip trailing installment markers like "11/12"
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    // strip long numeric sequences (auth codes, doc numbers)
    .replace(/\b\d{4,}\b/g, " ")
    // strip acquirer prefixes like "mp *", "cb*", "pag*", "pp*"
    .replace(/\b[a-z]{1,4}\s*\*+\s*/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(s: string): string[] {
  return stripNoise(s)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function buildMerchantKey(description: string): { key: string; prefix: string } | null {
  const toks = significantTokens(description);
  if (toks.length === 0) return null;
  const key = toks.slice(0, 2).join("");
  const prefix = key.slice(0, 6);
  return { key, prefix: prefix.length >= 4 ? prefix : key };
}

// Layer 0 normalization: preserve identity of the description.
// Strips only installment markers, acquirer prefixes and punctuation.
function normalizeDescription(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\b[a-z]{1,4}\s*\*+\s*/g, " ")
    .replace(/\*+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- History entry / voting ----

type HistEntry = {
  category: string;
  subcategory: string | null;
  subcategory2: string | null;
  type: string;
  payment_date: string;
};

function pickBest(entries: HistEntry[]): HistEntry | null {
  if (entries.length === 0) return null;
  const counts = new Map<string, { entry: HistEntry; count: number; latest: string }>();
  for (const e of entries) {
    const k = `${e.category}||${e.subcategory ?? ""}||${e.subcategory2 ?? ""}`;
    const cur = counts.get(k);
    if (cur) {
      cur.count += 1;
      if (e.payment_date > cur.latest) cur.latest = e.payment_date;
    } else {
      counts.set(k, { entry: e, count: 1, latest: e.payment_date });
    }
  }
  let best: { entry: HistEntry; count: number; latest: string } | null = null;
  for (const c of counts.values()) {
    if (!best) { best = c; continue; }
    if (c.count > best.count) { best = c; continue; }
    if (c.count === best.count) {
      const dCur = c.entry.subcategory2 ? 3 : c.entry.subcategory ? 2 : 1;
      const dBest = best.entry.subcategory2 ? 3 : best.entry.subcategory ? 2 : 1;
      if (dCur > dBest) { best = c; continue; }
      if (dCur === dBest && c.latest > best.latest) best = c;
    }
  }
  if (!best) return null;
  // require ≥60% consensus among the matched samples
  if (best.count / entries.length < 0.6) return null;
  return best.entry;
}

/**
 * Hybrid category suggestions:
 *  - Stage 1: learn from user's own history — merchant-key exact/prefix match,
 *    then token overlap. Uses both `transactions` (24mo) and approved
 *    `ai_pending_transactions` as samples.
 *  - Stage 2: AI edge function for whatever Stage 1 couldn't resolve.
 */
export function useCategorySuggestions() {
  const effectiveUserId = useEffectiveUserId();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, SuggestionSource>>({});

  const reset = useCallback(() => setSuggestions({}), []);

  const suggest = useCallback(
    async (
      rows: NewRowInput[],
      categories: { id: string; name: string; parent_id: string | null; type: string | null }[],
    ) => {
      if (rows.length === 0 || categories.length === 0) {
        setSuggestions({});
        return {};
      }

      setLoading(true);
      const result: Record<number, SuggestionSource> = {};

      try {
        // Normalize category storage: transactions may hold UUIDs OR names.
        // IMPORTANT: history samples can reference category names that are NOT
        // currently in the user's category tree (renamed / different casing /
        // legacy). We must NOT discard those — the modal's resolveCategoryPath
        // will map them by normalized name later. Only strictly empty or
        // "Sem Categoria" values are treated as missing.
        const byId = new Map(categories.map((c) => [c.id, c] as const));
        const byName = new Map(categories.map((c) => [c.name, c] as const));

        const normText = (s: string) =>
          s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        const isMissingCat = (v: string | null | undefined): boolean => {
          if (!v) return true;
          const t = normText(v);
          if (!t) return true;
          return t === "sem categoria" || t === "sem categoria ";
        };

        // Resolve a stored value (UUID or name) into a human name.
        // Falls back to the raw value when it's a plausible name so we don't
        // silently drop valid historical categories.
        const toName = (v: string | null | undefined): string | null => {
          if (isMissingCat(v)) return null;
          const raw = v as string;
          const hit = byId.get(raw);
          if (hit) return hit.name;
          if (byName.has(raw)) return raw;
          // Not in the local tree — keep the raw name; resolveCategoryPath
          // in the modal will normalize casing/accents when applying.
          return raw;
        };

        const sinceISO = (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 24);
          return d.toISOString().slice(0, 10);
        })();

        // ---- Stage 1: load samples in parallel ----
        // STRICT per-user isolation: every query is scoped to effectiveUserId.
        const [txRes, pendingRes] = await Promise.all([
          supabase
            .from("transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date")
            .eq("user_id", effectiveUserId)
            .not("category", "is", null)
            .neq("category", "Sem Categoria")
            .neq("category", "Sem categoria")
            .gte("payment_date", sinceISO)
            .order("payment_date", { ascending: false })
            .limit(5000),
          supabase
            .from("ai_pending_transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date")
            .eq("user_id", effectiveUserId)
            .eq("status", "approved")
            .not("category", "is", null)
            .neq("category", "Sem Categoria")
            .neq("category", "Sem categoria")
            .limit(2000),
        ]);

        const rawSamples: any[] = [
          ...((txRes.data as any[]) || []),
          ...((pendingRes.data as any[]) || []),
        ];

        // Build indexes over the same samples.
        const byNormDesc = new Map<string, HistEntry[]>();
        const byMerchantKey = new Map<string, HistEntry[]>();
        const byMerchantPrefix = new Map<string, HistEntry[]>();
        const byToken = new Map<string, HistEntry[]>();

        for (const h of rawSamples) {
          const catName = toName(h.category);
          if (!catName) continue; // skip uncategorized samples
          // Treat "Sem categoria" at sub-levels as absent, not as a real level.
          const sub = isMissingCat(h.subcategory) ? null : toName(h.subcategory);
          const sub2 = isMissingCat(h.subcategory2) ? null : toName(h.subcategory2);
          const entry: HistEntry = {
            category: catName,
            subcategory: sub,
            subcategory2: sub2,
            type: h.type,
            payment_date: h.payment_date || "1970-01-01",
          };
          const desc = h.description || "";
          const norm = normalizeDescription(desc);
          if (norm) {
            const arrN = byNormDesc.get(norm) || [];
            arrN.push(entry);
            byNormDesc.set(norm, arrN);
          }
          const mk = buildMerchantKey(desc);
          if (mk) {
            const arrK = byMerchantKey.get(mk.key) || [];
            arrK.push(entry);
            byMerchantKey.set(mk.key, arrK);
            const arrP = byMerchantPrefix.get(mk.prefix) || [];
            arrP.push(entry);
            byMerchantPrefix.set(mk.prefix, arrP);
          }
          for (const tok of significantTokens(desc)) {
            const arr = byToken.get(tok) || [];
            arr.push(entry);
            byToken.set(tok, arr);
          }
        }


        const unresolved: NewRowInput[] = [];

        const applyEntry = (row: NewRowInput, entry: HistEntry, confidence: number) => {
          // SuggestionSource.category is the TOP-LEVEL category name; the modal
          // uses subcategory/subcategory2 to fill the hierarchy. Keeping the
          // top-level here also makes the "baseado no histórico" badge match.
          result[row.index] = {
            category: entry.category,
            source: "history",
            confidence,
            subcategory: entry.subcategory ?? undefined,
            subcategory2: entry.subcategory2 ?? undefined,
          };
        };


        // Prefer the deepest + most recent entry among a candidate list.
        const pickDeepestRecent = (entries: HistEntry[]): HistEntry | null => {
          if (entries.length === 0) return null;
          let best = entries[0];
          const depth = (e: HistEntry) => (e.subcategory2 ? 3 : e.subcategory ? 2 : 1);
          for (const e of entries.slice(1)) {
            const dE = depth(e);
            const dB = depth(best);
            if (dE > dB) { best = e; continue; }
            if (dE === dB && e.payment_date > best.payment_date) best = e;
          }
          return best;
        };

        for (const row of rows) {
          // Layer 0: exact / prefix match on normalized description
          const normRow = normalizeDescription(row.description);
          if (normRow) {
            const direct = (byNormDesc.get(normRow) || []).filter((e) => e.type === row.type);
            let hit = pickDeepestRecent(direct);
            if (!hit) {
              // fallback: any historical normDesc that startsWith the current normRow, or vice-versa
              const candidates: HistEntry[] = [];
              for (const [k, arr] of byNormDesc.entries()) {
                if (k === normRow) continue;
                if (k.startsWith(normRow) || normRow.startsWith(k)) {
                  for (const e of arr) if (e.type === row.type) candidates.push(e);
                }
              }
              hit = pickDeepestRecent(candidates);
            }
            if (hit) { applyEntry(row, hit, 4); continue; }
          }

          const mk = buildMerchantKey(row.description);
          const tokens = significantTokens(row.description);


          // Layer 1: exact merchant key
          if (mk) {
            const hits = (byMerchantKey.get(mk.key) || []).filter((e) => e.type === row.type);
            const best = pickBest(hits);
            if (best) { applyEntry(row, best, 3); continue; }
          }
          // Layer 2: merchant prefix
          if (mk) {
            const hits = (byMerchantPrefix.get(mk.prefix) || []).filter((e) => e.type === row.type);
            const best = pickBest(hits);
            if (best) { applyEntry(row, best, 2); continue; }
          }
          // Layer 3: token overlap
          if (tokens.length > 0) {
            const tripleCounts = new Map<string, { entry: HistEntry; score: number; longHit: boolean; latest: string }>();
            for (const tok of tokens) {
              const isLong = tok.length >= 7;
              const hits = byToken.get(tok) || [];
              for (const h of hits) {
                if (h.type !== row.type) continue;
                const k = `${h.category}||${h.subcategory ?? ""}||${h.subcategory2 ?? ""}`;
                const cur = tripleCounts.get(k);
                if (cur) {
                  cur.score += 1;
                  if (isLong) cur.longHit = true;
                  if (h.payment_date > cur.latest) cur.latest = h.payment_date;
                } else {
                  tripleCounts.set(k, { entry: h, score: 1, longHit: isLong, latest: h.payment_date });
                }
              }
            }
            if (tripleCounts.size > 0) {
              let best: { entry: HistEntry; score: number; longHit: boolean; latest: string } | null = null;
              for (const c of tripleCounts.values()) {
                if (!best) { best = c; continue; }
                if (c.score > best.score) { best = c; continue; }
                if (c.score === best.score) {
                  const dCur = c.entry.subcategory2 ? 3 : c.entry.subcategory ? 2 : 1;
                  const dBest = best.entry.subcategory2 ? 3 : best.entry.subcategory ? 2 : 1;
                  if (dCur > dBest) { best = c; continue; }
                  if (dCur === dBest && c.latest > best.latest) best = c;
                }
              }
              const accept = !!best && (best.score >= 2 || (best.score === 1 && best.longHit));
              if (accept && best) {
                applyEntry(row, best.entry, best.score);
                continue;
              }
            }
          }

          unresolved.push(row);
        }

        // AI fallback intentionally disabled — history-only matching is safer
        // and more predictable. Unresolved rows stay as "Sem categoria" for
        // the user to adjust manually.


        setSuggestions(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [effectiveUserId],
  );

  return { suggest, suggestions, loading, reset };
}

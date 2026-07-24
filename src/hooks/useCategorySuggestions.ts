import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export type SuggestionLayer = "exact" | "prefix" | "merchant" | "token";

export interface MatchedSample {
  description: string;
  payment_date: string;
  amount: number | null;
  categoryPath: string;
  sourceTable?: "transactions" | "ai_pending_transactions";
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
  /** UUIDs used to rebuild the exact category path when the same name exists in multiple contexts. */
  categoryId?: string;
  subcategoryId?: string;
  subcategory2Id?: string;
  /** Database table that supplied the chosen historical sample. */
  sourceTable?: "transactions" | "ai_pending_transactions";
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
  // nomes/sobrenomes comuns demais para inferir categoria por 1 token só
  "ferreira", "silva", "santos", "souza", "sousa", "oliveira", "pereira",
  "costa", "rocha", "almeida", "lima", "gomes", "ribeiro", "carvalho",
  "martins", "barbosa", "araujo", "melo", "cardoso", "paulo", "pedro",
  "maria", "jose", "joao", "luma", "borges",
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
    // split issuer names glued to long authorization/ticket numbers: LINEA075211...
    .replace(/\b([a-z]{3,})\d{3,}\b/g, "$1 ")
    // strip long numeric sequences (auth codes, doc numbers)
    .replace(/\b\d{3,}\b/g, " ")
    // strip "iof internacional -" prefix
    .replace(/^iof internacional\s*-?\s*/i, " ")
    // strip well-known marketplace prefixes so the merchant stays visible
    .replace(/\bamazonmktplc\*?/g, " ")
    .replace(/\bamazon marketplace\b/g, " ")
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
// Strips installment markers, IOF/marketplace prefixes, long numeric codes
// and acquirer prefixes so "DROGASIL 3066" and "Compra na Drogasil 1424 03/03"
// converge to the same key.
function normalizeDescription(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\b([a-z]{3,})\d{3,}\b/g, "$1 ")
    .replace(/^iof internacional\s*-?\s*/i, " ")
    .replace(/\bamazonmktplc\*?/g, " ")
    .replace(/\bamazon marketplace\b/g, " ")
    .replace(/\b[a-z]{1,4}\s*\*+\s*/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ---- History entry / voting ----

type HistEntry = {
  category: string;
  categoryId: string | null;
  subcategory: string | null;
  subcategoryId: string | null;
  subcategory2: string | null;
  subcategory2Id: string | null;
  type: string;
  payment_date: string;
  description: string;
  amount: number | null;
  sourceTable: "transactions" | "ai_pending_transactions";
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
  const depth = (e: HistEntry) => (e.subcategory2 ? 3 : e.subcategory ? 2 : 1);
  for (const c of counts.values()) {
    if (!best) { best = c; continue; }
    const dCur = depth(c.entry);
    const dBest = depth(best.entry);
    const curScore = c.count * 4 + dCur * 8;
    const bestScore = best.count * 4 + dBest * 8;
    if (curScore > bestScore) { best = c; continue; }
    if (curScore === bestScore && c.count > best.count) { best = c; continue; }
    if (curScore === bestScore && c.count === best.count && c.latest > best.latest) best = c;
  }
  if (!best) return null;
  // Avoid learning from one isolated conflicting row, but allow a deeper path
  // with repeated evidence to beat a broader category with more samples.
  if (entries.length > 1 && best.count < 2 && best.count / entries.length < 0.6) return null;
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
        // IMPORTANT: history samples can reference categories from a DIFFERENT
        // context (Pessoal vs Empresa) than the one currently active. The
        // `categories` param is context-scoped, so we must ALSO load the full
        // set of the user's categories (all contexts) to resolve UUIDs into
        // human names. Otherwise UUIDs leak into the UI and history matches
        // are silently dropped.
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

        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const sinceISO = (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 24);
          return d.toISOString().slice(0, 10);
        })();

        // ---- Stage 1: load samples + full category dictionary in parallel ----
        // STRICT per-user isolation: every query is scoped to effectiveUserId.
        const [txRes, pendingRes, allCatsRes] = await Promise.all([
          supabase
            .from("transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date, amount")
            .eq("user_id", effectiveUserId)
            .not("category", "is", null)
            .neq("category", "Sem Categoria")
            .neq("category", "Sem categoria")
            .gte("payment_date", sinceISO)
            .order("payment_date", { ascending: false })
            .limit(5000),
          supabase
            .from("ai_pending_transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date, amount")
            .eq("user_id", effectiveUserId)
            .eq("status", "approved")
            .not("category", "is", null)
            .neq("category", "Sem Categoria")
            .neq("category", "Sem categoria")
            .limit(2000),
          supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", effectiveUserId),
        ]);

        // Full id→name / name→id dictionary across ALL contexts of THIS user.
        const byIdAll = new Map<string, string>();
        const namesAll = new Set<string>();
        for (const c of ((allCatsRes.data as any[]) || [])) {
          if (c?.id && c?.name) {
            byIdAll.set(c.id, c.name);
            namesAll.add(c.name);
          }
        }
        // Fold the current-context lists too (defensive).
        for (const [id, c] of byId) byIdAll.set(id, c.name);
        for (const n of byName.keys()) namesAll.add(n);

        // Resolve a stored value (UUID or name) into a human name.
        // Returns null when we cannot resolve into a real name — this prevents
        // UUIDs from ever reaching the UI.
        const toName = (v: string | null | undefined): string | null => {
          if (isMissingCat(v)) return null;
          const raw = (v as string).trim();
          const hit = byIdAll.get(raw);
          if (hit) return hit;
          if (namesAll.has(raw)) return raw;
          // Looks like a UUID but not in our dictionary → orphan reference,
          // drop it so no raw ID leaks to the suggestion.
          if (UUID_RE.test(raw)) return null;
          // Plain string that doesn't exist in the tree either — keep it so
          // resolveCategoryPath in the modal can still try a name match.
          return raw;
        };

        const toKnownId = (v: string | null | undefined): string | null => {
          if (!v || isMissingCat(v)) return null;
          const raw = v.trim();
          return UUID_RE.test(raw) && byIdAll.has(raw) ? raw : null;
        };

        const rawSamples: (any & { sourceTable: "transactions" | "ai_pending_transactions" })[] = [
          ...(((txRes.data as any[]) || []).map((r) => ({ ...r, sourceTable: "transactions" as const }))),
          ...(((pendingRes.data as any[]) || []).map((r) => ({ ...r, sourceTable: "ai_pending_transactions" as const }))),
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
          const desc = h.description || "";
          const entry: HistEntry = {
            category: catName,
            categoryId: toKnownId(h.category),
            subcategory: sub,
            subcategoryId: toKnownId(h.subcategory),
            subcategory2: sub2,
            subcategory2Id: toKnownId(h.subcategory2),
            type: h.type,
            payment_date: h.payment_date || "1970-01-01",
            description: desc,
            amount: typeof h.amount === "number" ? h.amount : (h.amount != null ? Number(h.amount) : null),
            sourceTable: h.sourceTable,
          };

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

        const toSample = (e: HistEntry): MatchedSample => ({
          description: e.description,
          payment_date: e.payment_date,
          amount: e.amount,
          categoryPath: [e.category, e.subcategory, e.subcategory2]
            .filter(Boolean)
            .join(" › "),
          sourceTable: e.sourceTable,
        });

        const applyEntry = (
          row: NewRowInput,
          entry: HistEntry,
          confidence: number,
          meta: {
            layer: SuggestionLayer;
            normalizedQuery: string;
            candidates: HistEntry[];
          },
        ) => {
          const chosenKey = `${entry.category}||${entry.subcategory ?? ""}||${entry.subcategory2 ?? ""}`;
          const agreeing = meta.candidates.filter(
            (c) => `${c.category}||${c.subcategory ?? ""}||${c.subcategory2 ?? ""}` === chosenKey,
          );
          const samplesSorted = (agreeing.length > 0 ? agreeing : [entry])
            .slice()
            .sort((a, b) => (b.payment_date > a.payment_date ? 1 : -1))
            .slice(0, 3)
            .map(toSample);
          result[row.index] = {
            category: entry.category,
            source: "history",
            confidence,
            subcategory: entry.subcategory ?? undefined,
            subcategory2: entry.subcategory2 ?? undefined,
            categoryId: entry.categoryId ?? undefined,
            subcategoryId: entry.subcategoryId ?? undefined,
            subcategory2Id: entry.subcategory2Id ?? undefined,
            sourceTable: entry.sourceTable,
            layer: meta.layer,
            normalizedQuery: meta.normalizedQuery,
            matchedSamples: samplesSorted,
            voteCount: agreeing.length || 1,
            candidateCount: meta.candidates.length || 1,
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
            let layer: SuggestionLayer = "exact";
            let candidates = direct;
            if (!hit) {
              // fallback: any historical normDesc that startsWith the current normRow, or vice-versa
              const prefixCands: HistEntry[] = [];
              for (const [k, arr] of byNormDesc.entries()) {
                if (k === normRow) continue;
                if (k.startsWith(normRow) || normRow.startsWith(k)) {
                  for (const e of arr) if (e.type === row.type) prefixCands.push(e);
                }
              }
              hit = pickDeepestRecent(prefixCands);
              layer = "prefix";
              candidates = prefixCands;
            }
            if (hit) {
              applyEntry(row, hit, 4, { layer, normalizedQuery: normRow, candidates });
              continue;
            }
          }

          const mk = buildMerchantKey(row.description);
          const tokens = significantTokens(row.description);


          // Layer 1: exact merchant key
          if (mk) {
            const hits = (byMerchantKey.get(mk.key) || []).filter((e) => e.type === row.type);
            const best = pickBest(hits);
            if (best) {
              applyEntry(row, best, 3, { layer: "merchant", normalizedQuery: mk.key, candidates: hits });
              continue;
            }
          }
          // Layer 2: merchant prefix
          if (mk) {
            const hits = (byMerchantPrefix.get(mk.prefix) || []).filter((e) => e.type === row.type);
            const best = pickBest(hits);
            if (best) {
              applyEntry(row, best, 2, { layer: "merchant", normalizedQuery: mk.prefix, candidates: hits });
              continue;
            }
          }
          // Layer 3: token overlap
          if (tokens.length > 0) {
            const tripleCounts = new Map<string, { entry: HistEntry; score: number; longHit: boolean; latest: string; entries: HistEntry[] }>();
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
                  cur.entries.push(h);
                } else {
                  tripleCounts.set(k, { entry: h, score: 1, longHit: isLong, latest: h.payment_date, entries: [h] });
                }
              }
            }
            if (tripleCounts.size > 0) {
              let best: { entry: HistEntry; score: number; longHit: boolean; latest: string; entries: HistEntry[] } | null = null;
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
                applyEntry(row, best.entry, best.score, {
                  layer: "token",
                  normalizedQuery: tokens.join(" "),
                  candidates: best.entries,
                });
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

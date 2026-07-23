import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export interface SuggestionSource {
  category: string;
  source: "history" | "ai";
  confidence?: number;
  subcategory?: string;
  subcategory2?: string;
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
        const byId = new Map(categories.map((c) => [c.id, c] as const));
        const byName = new Map(categories.map((c) => [c.name, c] as const));
        const toName = (v: string | null | undefined): string | null => {
          if (!v) return null;
          const hit = byId.get(v);
          if (hit) return hit.name;
          if (byName.has(v)) return v;
          return null;
        };

        const sinceISO = (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 24);
          return d.toISOString().slice(0, 10);
        })();

        // ---- Stage 1: load samples in parallel ----
        const [txRes, pendingRes] = await Promise.all([
          supabase
            .from("transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date")
            .eq("user_id", effectiveUserId)
            .not("category", "is", null)
            .neq("category", "Sem Categoria")
            .gte("payment_date", sinceISO)
            .order("payment_date", { ascending: false })
            .limit(5000),
          supabase
            .from("ai_pending_transactions")
            .select("description, category, subcategory, subcategory2, type, payment_date")
            .eq("user_id", effectiveUserId)
            .eq("status", "approved")
            .not("category", "is", null)
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
          if (!catName) continue;
          const entry: HistEntry = {
            category: catName,
            subcategory: toName(h.subcategory),
            subcategory2: toName(h.subcategory2),
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
          const leaf = entry.subcategory2 || entry.subcategory || entry.category;
          result[row.index] = {
            category: leaf,
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

        // ---- Stage 2: AI fallback for the rest ----
        if (unresolved.length > 0) {
          try {
            const byIdCat = new Map(categories.map((c) => [c.id, c] as const));
            const pathOf = (c: { id: string; name: string; parent_id: string | null }): string[] => {
              const chain: string[] = [c.name];
              let cur = c;
              const seen = new Set<string>([c.id]);
              while (cur.parent_id) {
                const parent = byIdCat.get(cur.parent_id);
                if (!parent || seen.has(parent.id)) break;
                chain.unshift(parent.name);
                seen.add(parent.id);
                cur = parent;
              }
              return chain;
            };
            const catPayload = categories.map((c) => ({
              name: c.name,
              path: pathOf(c),
              type: c.type,
            }));

            const { data, error } = await supabase.functions.invoke("suggest-categories", {
              body: {
                items: unresolved.map((r) => ({
                  index: r.index,
                  description: r.description,
                  type: r.type,
                  amount: r.amount,
                })),
                categories: catPayload,
              },
            });
            if (error) {
              console.error("[useCategorySuggestions] AI error", error);
            } else if (data?.suggestions) {
              for (const s of data.suggestions as {
                index: number;
                category: string | null;
                subcategory?: string | null;
                subcategory2?: string | null;
              }[]) {
                if (s.category) {
                  result[s.index] = {
                    category: s.category,
                    subcategory: s.subcategory ?? undefined,
                    subcategory2: s.subcategory2 ?? undefined,
                    source: "ai",
                  };
                }
              }
            }
          } catch (e) {
            console.error("[useCategorySuggestions] AI fetch failed", e);
          }
        }

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

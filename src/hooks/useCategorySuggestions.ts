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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 4);
}

/**
 * Hybrid category suggestions:
 *  - First, look up similar past transactions of the same user. If multiple
 *    historical hits agree on a category, use it (deterministic, free).
 *  - Then call the AI edge function for the remaining items.
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
        // ---- Stage 1: history match ----
        // transactions.category / subcategory / subcategory2 may store either
        // category UUIDs (new writes) or names (legacy). Normalize to names
        // via the categories lookup before indexing.
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
          d.setMonth(d.getMonth() - 12);
          return d.toISOString().slice(0, 10);
        })();


        const { data: history } = await supabase
          .from("transactions")
          .select("description, category, subcategory, subcategory2, type")
          .eq("user_id", effectiveUserId)
          .not("category", "is", null)
          .neq("category", "Sem Categoria")
          .gte("payment_date", sinceISO)
          .limit(2000);

        // Build token index: token → array of {category, subcategory, subcategory2, type}
        type HistEntry = {
          category: string;
          subcategory: string | null;
          subcategory2: string | null;
          type: string;
        };
        const tokenIdx = new Map<string, HistEntry[]>();
        (history || []).forEach((h: any) => {
          const catName = toName(h.category);
          if (!catName) return;
          const entry: HistEntry = {
            category: catName,
            subcategory: toName(h.subcategory),
            subcategory2: toName(h.subcategory2),
            type: h.type,
          };
          tokenize(h.description || "").forEach((tok) => {
            const arr = tokenIdx.get(tok) || [];
            arr.push(entry);
            tokenIdx.set(tok, arr);
          });
        });


        const unresolved: NewRowInput[] = [];
        for (const row of rows) {
          const tokens = tokenize(row.description);
          if (tokens.length === 0) {
            unresolved.push(row);
            continue;
          }
          // Score each triple by token+type matches; track if any winning token was long (>=6)
          const tripleCounts = new Map<string, { entry: HistEntry; score: number; longHit: boolean }>();
          tokens.forEach((tok) => {
            const hits = tokenIdx.get(tok) || [];
            const isLong = tok.length >= 6;
            hits.forEach((h) => {
              if (h.type !== row.type) return;
              const key = `${h.category}||${h.subcategory ?? ""}||${h.subcategory2 ?? ""}`;
              const cur = tripleCounts.get(key);
              if (cur) {
                cur.score += 1;
                if (isLong) cur.longHit = true;
              } else {
                tripleCounts.set(key, { entry: h, score: 1, longHit: isLong });
              }
            });
          });
          if (tripleCounts.size === 0) {
            unresolved.push(row);
            continue;
          }
          // Pick top triple (deepest path wins tie-breaks)
          let best: { entry: HistEntry; score: number; longHit: boolean } | null = null;
          for (const cur of tripleCounts.values()) {
            if (!best) { best = cur; continue; }
            if (cur.score > best.score) { best = cur; continue; }
            if (cur.score === best.score) {
              const depthCur = (cur.entry.subcategory2 ? 3 : cur.entry.subcategory ? 2 : 1);
              const depthBest = (best.entry.subcategory2 ? 3 : best.entry.subcategory ? 2 : 1);
              if (depthCur > depthBest) best = cur;
            }
          }
          // Accept: ≥2 token matches OR exactly 1 match if that token is long (≥6 letters)
          const accept = !!best && (best.score >= 2 || (best.score === 1 && best.longHit));
          if (accept && best) {
            const leaf =
              best.entry.subcategory2 || best.entry.subcategory || best.entry.category;
            result[row.index] = {
              category: leaf,
              source: "history",
              confidence: best.score,
              subcategory: best.entry.subcategory ?? undefined,
              subcategory2: best.entry.subcategory2 ?? undefined,
            };
          } else {
            unresolved.push(row);
          }
        }



        // ---- Stage 2: AI fallback ----
        if (unresolved.length > 0) {
          try {
            const { data, error } = await supabase.functions.invoke("suggest-categories", {
              body: {
                items: unresolved.map((r) => ({
                  index: r.index,
                  description: r.description,
                  type: r.type,
                  amount: r.amount,
                })),
                categories: categories.map((c) => ({ name: c.name, type: c.type })),
              },
            });
            if (error) {
              console.error("[useCategorySuggestions] AI error", error);
            } else if (data?.suggestions) {
              for (const s of data.suggestions as { index: number; category: string | null }[]) {
                if (s.category) {
                  result[s.index] = { category: s.category, source: "ai" };
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

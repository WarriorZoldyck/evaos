import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export interface SuggestionSource {
  category: string;
  source: "history" | "ai";
  confidence?: number;
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
        // We look up not just the top-level `category`, but the full triple
        // (category, subcategory, subcategory2) so we can propose the deepest
        // leaf the user has consistently classified. `resolveCategoryPath` in
        // the caller expands a leaf name back into the 3-level path.
        const validCatNames = new Set(categories.map((c) => c.name));
        const sinceISO = (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 6);
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
          if (!h.category || !validCatNames.has(h.category)) return;
          const entry: HistEntry = {
            category: h.category,
            subcategory: h.subcategory && validCatNames.has(h.subcategory) ? h.subcategory : null,
            subcategory2:
              h.subcategory2 && validCatNames.has(h.subcategory2) ? h.subcategory2 : null,
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
          // Score each triple by token+type matches
          const tripleCounts = new Map<string, { entry: HistEntry; score: number }>();
          tokens.forEach((tok) => {
            const hits = tokenIdx.get(tok) || [];
            hits.forEach((h) => {
              if (h.type !== row.type) return;
              const key = `${h.category}||${h.subcategory ?? ""}||${h.subcategory2 ?? ""}`;
              const cur = tripleCounts.get(key);
              if (cur) cur.score += 1;
              else tripleCounts.set(key, { entry: h, score: 1 });
            });
          });
          if (tripleCounts.size === 0) {
            unresolved.push(row);
            continue;
          }
          // Pick top triple (deepest path wins tie-breaks)
          let best: { entry: HistEntry; score: number } | null = null;
          for (const cur of tripleCounts.values()) {
            if (!best) { best = cur; continue; }
            if (cur.score > best.score) { best = cur; continue; }
            if (cur.score === best.score) {
              const depthCur = (cur.entry.subcategory2 ? 3 : cur.entry.subcategory ? 2 : 1);
              const depthBest = (best.entry.subcategory2 ? 3 : best.entry.subcategory ? 2 : 1);
              if (depthCur > depthBest) best = cur;
            }
          }
          // Require at least 2 token matches on the winning triple
          if (best && best.score >= 2) {
            // Return the DEEPEST leaf name so resolveCategoryPath expands the
            // full 3-level path on the caller side.
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

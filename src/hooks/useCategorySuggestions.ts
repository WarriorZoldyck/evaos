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
        const validCatNames = new Set(categories.map((c) => c.name));
        const sinceISO = (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 6);
          return d.toISOString().slice(0, 10);
        })();

        const { data: history } = await supabase
          .from("transactions")
          .select("description, category, type")
          .eq("user_id", effectiveUserId)
          .not("category", "is", null)
          .neq("category", "Sem Categoria")
          .gte("payment_date", sinceISO)
          .limit(2000);

        // Build token index: token → array of {category, type}
        const tokenIdx = new Map<string, { category: string; type: string }[]>();
        (history || []).forEach((h) => {
          if (!h.category || !validCatNames.has(h.category)) return;
          tokenize(h.description || "").forEach((tok) => {
            const arr = tokenIdx.get(tok) || [];
            arr.push({ category: h.category, type: h.type });
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
          // Score each category by token+type matches
          const counts = new Map<string, number>();
          tokens.forEach((tok) => {
            const hits = tokenIdx.get(tok) || [];
            hits.forEach((h) => {
              if (h.type === row.type) {
                counts.set(h.category, (counts.get(h.category) || 0) + 1);
              }
            });
          });
          if (counts.size === 0) {
            unresolved.push(row);
            continue;
          }
          // Pick top category
          let bestCat: string | null = null;
          let bestScore = 0;
          for (const [cat, score] of counts.entries()) {
            if (score > bestScore) {
              bestCat = cat;
              bestScore = score;
            }
          }
          // Require at least 2 token matches OR a single unique strong match
          if (bestCat && bestScore >= 2) {
            result[row.index] = { category: bestCat, source: "history", confidence: bestScore };
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

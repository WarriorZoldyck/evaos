import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";


interface SuggestItem {
  index: number;
  description: string;
  type: "receita" | "despesa";
  amount: number;
}

// Hierarchical category tree the client sends: each node knows its full path
// (["Supérfulo", "Perfume"]) so the AI can pick a leaf and we return category
// + subcategory + subcategory2 to the modal.
interface CategoryNode {
  name: string;
  path: string[]; // full path from root to this node
  type?: string | null;
}

interface RequestBody {
  items: SuggestItem[];
  categories: CategoryNode[] | { name: string; type?: string | null }[];
}

interface Suggestion {
  index: number;
  category: string | null;
  subcategory?: string | null;
  subcategory2?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.items?.length || !body?.categories?.length) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = body.items.slice(0, 200);
    const rawCategories = body.categories.slice(0, 300);

    // Normalize to CategoryNode with a path. Legacy callers may pass a flat list
    // — treat those as 1-level paths.
    const categories: CategoryNode[] = rawCategories.map((c: any) =>
      Array.isArray(c.path) && c.path.length > 0
        ? { name: c.name, path: c.path.map(String), type: c.type ?? null }
        : { name: c.name, path: [c.name], type: c.type ?? null },
    );

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Index every path by its "A > B > C" string for exact and normalized lookup.
    const pathToNode = new Map<string, CategoryNode>();
    const normPathToNode = new Map<string, CategoryNode>();
    for (const c of categories) {
      const key = c.path.join(" > ");
      pathToNode.set(key, c);
      normPathToNode.set(normalize(key), c);
    }

    const systemPrompt = `Você é o EVA, especialista em classificar transações financeiras no plano de contas hierárquico do usuário.

REGRAS:
- Responda APENAS com JSON puro, sem markdown, sem texto extra.
- Escolha SEMPRE o caminho MAIS PROFUNDO que fizer sentido. Se existir "Supérfulo > Perfume", NÃO devolva apenas "Supérfulo".
- Use exatamente uma das strings de caminho fornecidas (preserve acentos e maiúsculas). Exemplo: "Supérfulo > Perfume".
- Adicione "confidence": "high" | "medium" | "low".
  * high: merchant reconhecível casa claramente (ex.: "NETFLIX" → Streaming; "IBERIA LINEA" → Férias > Aéreo > Iberia).
  * medium: merchant/segmento razoavelmente identificável (ex.: "SPAY" cosméticos → Supérfulo > Perfume).
  * low: descrição genérica ou ambígua (ex.: "PAGAMENTO", "TRANSF", "DEBITO"). NÃO invente correspondência fraca — devolva low e será descartado.
- Se nenhum caminho for adequado, devolva confidence=low.
- TODO item recebido DEVE aparecer no array de resposta.

FORMATO:
{"suggestions": [{"index": 0, "path": "Alimentação > Restaurante", "confidence": "high"}, {"index": 1, "path": "Outros", "confidence": "low"}]}`;

    const chunkSize = 25;
    const batches: SuggestItem[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      batches.push(items.slice(i, i + chunkSize));
    }

    const pathList = categories.map((c) => c.path.join(" > "));

    const runBatch = async (batch: SuggestItem[]): Promise<Suggestion[] | { status: number }> => {
      const userPrompt = `Caminhos de categoria disponíveis (escolha um exatamente):
${pathList.map((p) => `- ${p}`).join("\n")}

Itens para categorizar:
${batch
  .map(
    (it) =>
      `[${it.index}] ${it.type === "receita" ? "Entrada" : "Saída"} R$${it.amount.toFixed(2)} — ${it.description}`,
  )
  .join("\n")}

Retorne JSON com {index, path, confidence} para CADA índice.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("[suggest-categories] gateway error", aiResponse.status, errText);
        return { status: aiResponse.status };
      }

      const data = await aiResponse.json();
      const content = data?.choices?.[0]?.message?.content ?? "{}";

      let parsed: {
        suggestions?: { index: number; path?: string; category?: string; confidence?: string }[];
      } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try {
            parsed = JSON.parse(match[1]);
          } catch {
            /* noop */
          }
        }
      }

      const out: Suggestion[] = [];
      for (const s of parsed.suggestions || []) {
        if (typeof s.index !== "number") continue;
        const conf = (s.confidence || "").toLowerCase();
        if (conf === "low") {
          out.push({ index: s.index, category: null });
          continue;
        }
        const raw = s.path || s.category || "";
        if (!raw) {
          out.push({ index: s.index, category: null });
          continue;
        }
        const node =
          pathToNode.get(raw) ??
          normPathToNode.get(normalize(raw)) ??
          // Fallback: treat as leaf name and match any path ending with it
          categories.find(
            (c) => normalize(c.path[c.path.length - 1]) === normalize(raw),
          ) ??
          null;
        if (!node) {
          out.push({ index: s.index, category: null });
          continue;
        }
        out.push({
          index: s.index,
          category: node.path[0] ?? null,
          subcategory: node.path[1] ?? null,
          subcategory2: node.path[2] ?? null,
        });
      }
      return out;
    };

    // Run all batches in parallel — 6× faster on large statements.
    const results = await Promise.all(batches.map(runBatch));

    for (const r of results) {
      if (Array.isArray(r)) continue;
      if (r.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limit", message: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (r.status === 402) {
        return new Response(
          JSON.stringify({ error: "credits_exhausted", message: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const allSuggestions: Suggestion[] = results.flatMap((r) => (Array.isArray(r) ? r : []));

    return new Response(JSON.stringify({ suggestions: allSuggestions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[suggest-categories] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

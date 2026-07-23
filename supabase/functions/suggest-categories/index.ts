import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface SuggestItem {
  index: number;
  description: string;
  type: "receita" | "despesa";
  amount: number;
}

interface RequestBody {
  items: SuggestItem[];
  categories: { name: string; type?: string | null }[];
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

    // Cap inputs to avoid token blow-ups; we also batch items so each model call stays manageable.
    const items = body.items.slice(0, 200);
    const categories = body.categories.slice(0, 120);
    const categoryNames = categories.map((c) => c.name);

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedIndex = new Map<string, string>();
    for (const name of categoryNames) normalizedIndex.set(normalize(name), name);

    const systemPrompt = `Você é o EVA, especialista em classificar transações financeiras em categorias do plano de contas do usuário.

REGRAS:
- Responda APENAS com JSON puro, sem markdown, sem texto extra.
- Para cada item recebido, escolha a categoria MAIS PROVÁVEL da lista fornecida (sempre escolha uma; nunca use null).
- A categoria DEVE ser exatamente uma string da lista (preserve acentos e maiúsculas).
- Adicione um campo "confidence" com "high", "medium" ou "low":
  * high: a descrição casa claramente com a categoria (ex.: "NETFLIX" → Streaming).
  * medium: casamento razoável por semelhança de merchant/segmento.
  * low: chute — você não tem certeza, mas é a melhor opção da lista.
- TODO item recebido DEVE estar no array de resposta.
- Considere tipo (receita/despesa), valor e descrição.

FORMATO DE SAÍDA:
{"suggestions": [{"index": 0, "category": "Alimentação", "confidence": "high"}, {"index": 1, "category": "Outros", "confidence": "low"}]}`;

    const chunkSize = 25;
    const batches: typeof items[] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      batches.push(items.slice(i, i + chunkSize));
    }

    const allSuggestions: { index: number; category: string | null }[] = [];

    for (const batch of batches) {
      const userPrompt = `Categorias disponíveis:
${categoryNames.map((n) => `- ${n}`).join("\n")}

Itens para categorizar:
${batch
  .map(
    (it) =>
      `[${it.index}] ${it.type === "receita" ? "Entrada" : "Saída"} R$${it.amount.toFixed(2)} — ${it.description}`,
  )
  .join("\n")}

Retorne o JSON com a sugestão de categoria + confidence para CADA índice listado.`;

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
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "rate_limit", message: "Limite de requisições atingido. Tente novamente em instantes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "credits_exhausted", message: "Créditos de IA esgotados. Adicione créditos no workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        continue;
      }

      const data = await aiResponse.json();
      const content = data?.choices?.[0]?.message?.content ?? "{}";

      let parsed: { suggestions?: { index: number; category: string | null; confidence?: string }[] } = {};
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

      for (const s of parsed.suggestions || []) {
        if (typeof s.index !== "number") continue;
        // Drop low-confidence suggestions — user reviews "Sem categoria" manually
        const conf = (s.confidence || "").toLowerCase();
        if (conf === "low") {
          allSuggestions.push({ index: s.index, category: null });
          continue;
        }
        let mapped: string | null = null;
        if (s.category) {
          const exact = categoryNames.includes(s.category) ? s.category : null;
          mapped = exact ?? normalizedIndex.get(normalize(s.category)) ?? null;
        }
        allSuggestions.push({ index: s.index, category: mapped });
      }
    }


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

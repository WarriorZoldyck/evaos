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

    // Cap input to avoid token blow-ups
    const items = body.items.slice(0, 80);
    const categories = body.categories.slice(0, 80);
    const categoryNames = categories.map((c) => c.name);

    const systemPrompt = `Você é o EVA, especialista em classificar transações financeiras em categorias do plano de contas do usuário.

REGRAS:
- Responda APENAS com JSON puro, sem markdown, sem texto extra.
- Para cada item, escolha a categoria mais provável da lista fornecida.
- A categoria DEVE ser exatamente uma string da lista (case-sensitive).
- Se não houver categoria razoável, use null.
- Considere o tipo (receita/despesa), valor e descrição.

FORMATO DE SAÍDA:
{"suggestions": [{"index": 0, "category": "Alimentação"}, {"index": 1, "category": null}]}`;

    const userPrompt = `Categorias disponíveis:
${categoryNames.map((n) => `- ${n}`).join("\n")}

Itens para categorizar:
${items
  .map(
    (it) =>
      `[${it.index}] ${it.type === "receita" ? "Entrada" : "Saída"} R$${it.amount.toFixed(2)} — ${it.description}`,
  )
  .join("\n")}

Retorne o JSON com a sugestão de categoria para cada índice.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
      return new Response(JSON.stringify({ error: "gateway_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { suggestions?: { index: number; category: string | null }[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to salvage JSON from markdown code blocks
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try { parsed = JSON.parse(match[1]); } catch { /* noop */ }
      }
    }

    const validCategorySet = new Set(categoryNames);
    const suggestions = (parsed.suggestions || [])
      .filter((s) => typeof s.index === "number")
      .map((s) => ({
        index: s.index,
        category: s.category && validCategorySet.has(s.category) ? s.category : null,
      }));

    return new Response(JSON.stringify({ suggestions }), {
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

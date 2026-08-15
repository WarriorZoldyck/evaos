import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const gap = Number(body.gap_reais || 0);
    const goalName = typeof body.goal_name === "string" ? body.goal_name : null;
    const topCategories = Array.isArray(body.top_categories) ? body.top_categories.slice(0, 5) : [];

    if (gap <= 0) {
      return new Response(JSON.stringify({ error: "gap_reais must be positive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catLines = topCategories
      .map((c: any, i: number) => `${i + 1}. ${c.name}: ${fmt(Number(c.total || 0))} gastos no ano`)
      .join("\n");

    const systemPrompt =
      "Você é a EVA, uma assistente financeira brasileira, objetiva e empática. " +
      "Responda SEMPRE em português do Brasil, em markdown, com no máximo 5 sugestões práticas. " +
      "Use bullets curtos. Nunca invente números. " +
      "Vocabulário obrigatório: 'metas orçamentárias' são as metas de entradas e saídas por categoria (fluxo de caixa) " +
      "e 'objetivos' são o destino da sobra (reserva de emergência, sonho, investimento, quitar dívida). Nunca confunda os dois.";


    const userPrompt =
      `${goalName ? `A meta é: "${goalName}". ` : ""}` +
      `O usuário precisa cortar/gerar **${fmt(gap)}** até o fim do ano para as metas caberem.\n\n` +
      (catLines
        ? `As maiores categorias de gasto dele neste ano são:\n${catLines}\n\n`
        : "Não há histórico de gastos categorizados.\n\n") +
      `Monte um plano de ação curto: 3-5 bullets com sugestões concretas e realistas (economias específicas por categoria, aumento de receita, revisões de assinaturas etc.). ` +
      `Priorize cortar nas categorias listadas quando fizer sentido. Termine com uma frase motivacional curta.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      return new Response(JSON.stringify({ error: `AI Gateway ${aiResponse.status}: ${text}` }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const plan = data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ plan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

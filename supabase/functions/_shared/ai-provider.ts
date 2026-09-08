// Provedor de IA da EVA: Google Gemini (API própria, chave GOOGLE_API_KEY),
// usando o endpoint compatível com OpenAI.

export const AI_CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Chave da API do Google Gemini. */
export function getAiApiKey(): string | undefined {
  return Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
}

/** Remove o prefixo de vendor (ex.: "google/gemini-2.5-pro" -> "gemini-2.5-pro"). */
export function toGeminiModel(model: string): string {
  const bare = model.includes("/") ? model.split("/").pop()! : model;
  // modelos de preview do gateway não existem na API pública
  if (bare === "gemini-3-flash-preview") return "gemini-2.5-flash";
  return bare;
}

export async function aiChat(
  apiKey: string,
  body: Record<string, unknown> & { model: string },
): Promise<Response> {
  return await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model: toGeminiModel(body.model) }),
  });
}

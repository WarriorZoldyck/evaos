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

/**
 * Transcreve um áudio (base64) usando a API nativa do Gemini, que aceita
 * audio/ogg (formato usado pelo WhatsApp). O endpoint compatível com OpenAI
 * não aceita partes do tipo "file", por isso a transcrição é feita à parte.
 */
export async function transcribeAudioBase64(
  apiKey: string,
  base64: string,
  mimetype: string,
  model = "gemini-2.5-flash",
): Promise<string | null> {
  const mimeType = (mimetype || "audio/ogg").split(";")[0].trim();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${toGeminiModel(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Transcreva integralmente este áudio em português do Brasil. Responda apenas com a transcrição, sem comentários.",
            },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("Gemini transcription error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p?.text ?? "").join("").trim();
  return text || null;
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

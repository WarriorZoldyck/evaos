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

/**
 * Envia um arquivo (PDF, imagem, etc.) para o Gemini usando a API nativa
 * `generateContent`, que aceita `inline_data`. O endpoint compatível com OpenAI
 * não aceita partes do tipo "file", por isso documentos passam por aqui.
 * Retorna um objeto no mesmo formato de resposta do chat/completions da OpenAI,
 * para reaproveitar os parsers existentes.
 */
export async function aiGenerateWithFile(
  apiKey: string,
  opts: {
    model: string;
    base64: string;
    mimeType: string;
    userText: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  },
): Promise<Response> {
  const mimeType = (opts.mimeType || "application/pdf").split(";")[0].trim();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${toGeminiModel(opts.model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      ...(opts.systemPrompt
        ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } }
        : {}),
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: opts.base64 } },
            { text: opts.userText },
          ],
        },
      ],
      generationConfig: {
        temperature: opts.temperature ?? 0,
        maxOutputTokens: opts.maxTokens ?? 8192,
      },
    }),
  });

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");
  const finish = cand?.finishReason === "MAX_TOKENS" ? "length" : "stop";

  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: text }, finish_reason: finish }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Extrai o conteúdo textual de um documento (PDF/imagem) em base64. */
export async function extractDocumentText(
  apiKey: string,
  base64: string,
  mimeType: string,
  model = "gemini-2.5-flash",
): Promise<string | null> {
  const res = await aiGenerateWithFile(apiKey, {
    model,
    base64,
    mimeType,
    maxTokens: 8192,
    userText:
      "Transcreva integralmente o conteúdo deste documento em texto puro, em português do Brasil. " +
      "Preserve TODOS os valores monetários, datas, nomes de estabelecimentos, parcelas, códigos de barras e linhas digitáveis. " +
      "Não resuma, não comente, não use markdown. Responda apenas com o conteúdo transcrito.",
  });
  if (!res.ok) {
    console.error("Gemini document extraction error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || null;
}

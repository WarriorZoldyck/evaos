// Shared AI Gateway for Supabase Edge Functions (WhatsApp Webhook, EVA Chat, Parse Bank Statement, Analysis, etc.)
// Direct integration with Google Gemini, OpenAI, OpenRouter, and Groq. 100% free of Lovable dependencies.

export interface AiRequestOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  messages: any[];
  response_format?: { type: string };
  signal?: AbortSignal;
  thinking_budget?: number;
}


export interface AiConfig {
  apiKey: string;
  provider: "gemini" | "openai" | "openrouter" | "groq";
  defaultModel: string;
  endpoint?: string;
}

export function getAiConfig(overrideApiKey?: string): AiConfig {
  // Check override or specific environment variables
  const geminiKey =
    (overrideApiKey && overrideApiKey.startsWith("AIza")) ? overrideApiKey :
    (Deno.env.get("GEMINI_API_KEY") ||
     Deno.env.get("GOOGLE_API_KEY") ||
     Deno.env.get("GOOGLE_GENAI_API_KEY") ||
     "").trim();

  const openAiKey =
    (overrideApiKey && overrideApiKey.startsWith("sk-") && !overrideApiKey.startsWith("sk-or-")) ? overrideApiKey :
    (Deno.env.get("OPENAI_API_KEY") || "").trim();

  const openRouterKey =
    (overrideApiKey && overrideApiKey.startsWith("sk-or-")) ? overrideApiKey :
    (Deno.env.get("OPENROUTER_API_KEY") || "").trim();

  const groqKey =
    (overrideApiKey && overrideApiKey.startsWith("gsk_")) ? overrideApiKey :
    (Deno.env.get("GROQ_API_KEY") || "").trim();

  const genericKey = (Deno.env.get("AI_API_KEY") || overrideApiKey || "").trim();

  // If generic key is provided, infer provider by prefix
  if (genericKey) {
    if (genericKey.startsWith("AIza")) {
      return { apiKey: genericKey, provider: "gemini", defaultModel: "gemini-2.5-flash" };
    }
    if (genericKey.startsWith("sk-or-")) {
      return { apiKey: genericKey, provider: "openrouter", defaultModel: "google/gemini-2.5-flash" };
    }
    if (genericKey.startsWith("gsk_")) {
      return { apiKey: genericKey, provider: "groq", defaultModel: "llama-3.3-70b-versatile" };
    }
    if (genericKey.startsWith("sk-")) {
      return { apiKey: genericKey, provider: "openai", defaultModel: "gpt-4o-mini" };
    }
  }

  // Check specific keys in priority order: Gemini > OpenAI > OpenRouter > Groq
  if (geminiKey) {
    return { apiKey: geminiKey, provider: "gemini", defaultModel: "gemini-2.5-flash" };
  }
  if (openAiKey) {
    return { apiKey: openAiKey, provider: "openai", defaultModel: "gpt-4o-mini" };
  }
  if (openRouterKey) {
    return { apiKey: openRouterKey, provider: "openrouter", defaultModel: "google/gemini-2.5-flash" };
  }
  if (groqKey) {
    return { apiKey: groqKey, provider: "groq", defaultModel: "llama-3.3-70b-versatile" };
  }

  return { apiKey: "", provider: "gemini", defaultModel: "gemini-2.5-flash" };
}

function normalizeGeminiModel(model?: string): string {
  if (!model) return "gemini-2.5-flash";
  let m = model.trim().replace(/^google\//i, "");
  if (m.includes("3-flash") || m.includes("flash-preview")) return "gemini-2.5-flash";
  if (m.includes("2.5-flash")) return "gemini-2.5-flash";
  if (m.includes("2.5-pro")) return "gemini-2.5-pro";
  if (m.includes("1.5-pro")) return "gemini-1.5-pro";
  if (m.includes("1.5-flash")) return "gemini-1.5-flash";
  if (m.includes("2.0-flash")) return "gemini-2.0-flash";
  if (m.startsWith("gpt-4o-mini")) return "gemini-2.5-flash";
  if (m.startsWith("gpt-4")) return "gemini-2.5-pro";
  if (!m.startsWith("gemini-")) return "gemini-2.5-flash";
  return m;
}

function normalizeOpenAiModel(model?: string): string {
  if (!model) return "gpt-4o-mini";
  const m = model.trim().toLowerCase();
  if (m.includes("pro") || m.includes("gpt-4o") && !m.includes("mini")) return "gpt-4o";
  return "gpt-4o-mini";
}

function normalizeOpenRouterModel(model?: string): string {
  if (!model) return "google/gemini-2.5-flash";
  let m = model.trim();
  if (m.startsWith("gemini-")) return `google/${m}`;
  return m;
}

/**
 * Calls Gemini using its native REST generateContent API.
 * Natively supports multi-page PDFs, images, audios, system instructions, and JSON schemas.
 * Returns an OpenAI-compatible Response object so all callers continue working without changes.
 */
async function callGeminiNative(options: AiRequestOptions, config: AiConfig): Promise<Response> {
  const model = normalizeGeminiModel(options.model || config.defaultModel);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  let systemText = "";
  const contents: any[] = [];

  for (const msg of options.messages || []) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      systemText = systemText ? `${systemText}\n\n${text}` : text;
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";
    const parts: any[] = [];

    if (typeof msg.content === "string") {
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (!item) continue;
        if (typeof item === "string") {
          parts.push({ text: item });
        } else if (item.type === "text" && item.text) {
          parts.push({ text: item.text });
        } else if (item.type === "image_url" && item.image_url?.url) {
          const urlStr = item.image_url.url;
          const match = urlStr.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2].replace(/\s/g, ""),
              },
            });
          } else {
            console.warn("[ai-gateway] Remote image URLs not directly inlined, passing as text ref:", urlStr.slice(0, 50));
            parts.push({ text: `[Image: ${urlStr}]` });
          }
        } else if (item.type === "file" && item.file) {
          const fileData = item.file.file_data || "";
          const match = fileData.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2].replace(/\s/g, ""),
              },
            });
          } else if (fileData) {
            const mimeType = item.file.filename?.endsWith(".pdf") ? "application/pdf"
              : item.file.filename?.endsWith(".ogg") ? "audio/ogg"
              : item.file.filename?.endsWith(".mp3") ? "audio/mp3"
              : "application/pdf";
            parts.push({
              inlineData: {
                mimeType,
                data: fileData.replace(/\s/g, ""),
              },
            });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  // Ensure at least one user content item
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Olá" }] });
  }

  const generationConfig: any = {};
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
  if (options.max_tokens) generationConfig.maxOutputTokens = options.max_tokens;
  if (options.response_format?.type === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }
  if (options.thinking_budget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: options.thinking_budget };
  } else {
    // Default to 0 thinking tokens for extraction & classification to prevent 70s+ timeouts
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const payload: any = { contents };
  if (systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  console.log(`[ai-gateway] Calling Gemini native model=${model} contents_count=${contents.length} has_system=${!!systemText}`);

  const geminiResponse = await fetch(url, {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    console.error(`[ai-gateway] Gemini API error ${geminiResponse.status}:`, errText.slice(0, 500));
    return new Response(errText, {
      status: geminiResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await geminiResponse.json();
  if (!data.candidates || data.candidates.length === 0) {
    const blockReason = data.promptFeedback?.blockReason || "unknown";
    console.error(`[ai-gateway] Gemini returned no candidates, blockReason=${blockReason}`);
    return new Response(JSON.stringify({ error: `Modelo recusou a resposta (motivo: ${blockReason})` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const candidate = data.candidates[0];
  const textParts = candidate?.content?.parts?.map((p: any) => p.text || "") || [];
  const textContent = textParts.join("");
  const finishReason = (candidate?.finishReason || "stop").toLowerCase();


  // Convert to standard OpenAI chat completion shape
  const openAiShape = {
    id: "chatcmpl-" + crypto.randomUUID(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
        },
        finish_reason: finishReason === "stop" ? "stop" : finishReason,
      },
    ],
    usage: data.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount,
      completion_tokens: data.usageMetadata.candidatesTokenCount,
      total_tokens: data.usageMetadata.totalTokenCount,
    } : undefined,
  };

  return new Response(JSON.stringify(openAiShape), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Calls OpenAI, OpenRouter, or Groq using OpenAI-compatible /v1/chat/completions schema.
 */
async function callOpenAiCompatible(options: AiRequestOptions, config: AiConfig): Promise<Response> {
  let endpoint = "https://api.openai.com/v1/chat/completions";
  let model = normalizeOpenAiModel(options.model);

  if (config.provider === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    model = normalizeOpenRouterModel(options.model || config.defaultModel);
  } else if (config.provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    model = "llama-3.3-70b-versatile";
  }

  // Adapt messages: convert { type: "file" } to { type: "image_url" }
  const adaptedMessages = (options.messages || []).map((msg) => {
    if (!Array.isArray(msg.content)) return msg;

    const adaptedContent = msg.content.map((item: any) => {
      if (item && item.type === "file" && item.file) {
        const fileData = item.file.file_data || "";
        return {
          type: "image_url",
          image_url: { url: fileData },
        };
      }
      return item;
    });

    return { ...msg, content: adaptedContent };
  });

  const payload: any = {
    model,
    messages: adaptedMessages,
  };
  if (options.max_tokens) payload.max_tokens = options.max_tokens;
  if (options.temperature !== undefined) payload.temperature = options.temperature;
  if (options.response_format) payload.response_format = options.response_format;

  console.log(`[ai-gateway] Calling ${config.provider} endpoint=${endpoint} model=${model}`);

  const res = await fetch(endpoint, {
    method: "POST",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(config.provider === "openrouter" ? {
        "HTTP-Referer": "https://evaos.com.br",
        "X-Title": "EVA OS",
      } : {}),
    },
    body: JSON.stringify(payload),
  });

  return res;
}

export async function fetchAiCompletions(options: AiRequestOptions, overrideApiKey?: string): Promise<Response> {
  const config = getAiConfig(overrideApiKey);

  if (!config.apiKey) {
    console.error("[ai-gateway] No AI API Key found in environment or parameters.");
    throw new Error(
      "Nenhuma chave de IA configurada nos Segredos do Supabase. Configure GEMINI_API_KEY ou OPENAI_API_KEY no painel de configurações do Supabase."
    );
  }

  if (config.provider === "gemini") {
    return await callGeminiNative(options, config);
  }

  return await callOpenAiCompatible(options, config);
}

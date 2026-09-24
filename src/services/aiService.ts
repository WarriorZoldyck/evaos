// Direct AI Service for EVA OS
// Bypasses Lovable credits dependency by using direct AI provider API keys (OpenAI, Gemini, OpenRouter, Groq)

export interface AiConfig {
  apiKey: string;
  provider: "openai" | "gemini" | "openrouter" | "groq" | "auto";
  model?: string;
}

const STORAGE_KEY = "eva_ai_config";

export function getStoredAiConfig(): AiConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey) return parsed;
    }
  } catch (e) {
    console.error("Failed to load saved AI config:", e);
  }

  // Fallback to environment variables
  const envOpenAI = import.meta.env.VITE_OPENAI_API_KEY;
  const envGemini = import.meta.env.VITE_GEMINI_API_KEY;
  const envOpenRouter = import.meta.env.VITE_OPENROUTER_API_KEY;
  const envGroq = import.meta.env.VITE_GROQ_API_KEY;

  if (envOpenAI) return { apiKey: envOpenAI, provider: "openai", model: "gpt-4o-mini" };
  if (envGemini) return { apiKey: envGemini, provider: "gemini", model: "gemini-2.5-flash" };
  if (envOpenRouter) return { apiKey: envOpenRouter, provider: "openrouter", model: "google/gemini-2.5-flash" };
  if (envGroq) return { apiKey: envGroq, provider: "groq", model: "llama-3.3-70b-versatile" };

  return { apiKey: "", provider: "auto" };
}

export function saveAiConfig(config: AiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save AI config:", e);
  }
}

export function detectProvider(apiKey: string): { endpoint: string; defaultModel: string; providerName: string } {
  const key = apiKey.trim();

  if (key.startsWith("AIza")) {
    return {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      defaultModel: "gemini-2.5-flash",
      providerName: "Google Gemini",
    };
  }
  if (key.startsWith("sk-or-")) {
    return {
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      defaultModel: "google/gemini-2.5-flash",
      providerName: "OpenRouter",
    };
  }
  if (key.startsWith("gsk_")) {
    return {
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      defaultModel: "llama-3.3-70b-versatile",
      providerName: "Groq",
    };
  }
  // Default to OpenAI
  return {
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    providerName: "OpenAI",
  };
}

export async function callDirectAi(
  messages: Array<{ role: string; content: any }>,
  configOverride?: AiConfig
): Promise<string> {
  const config = configOverride || getStoredAiConfig();

  if (!config.apiKey) {
    throw new Error(
      "Nenhuma chave de IA configurada. Clique no ícone de engrenagem ⚙️ no chat da EVA para adicionar sua chave de API (Google Gemini, OpenAI, OpenRouter ou Groq)."
    );
  }

  const { endpoint, defaultModel } = detectProvider(config.apiKey);
  const selectedModel = config.model || defaultModel;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || errorData.error || `Erro HTTP ${response.status}`;
    throw new Error(`Erro na API de IA (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A IA não retornou nenhuma resposta.");
  }

  return content;
}

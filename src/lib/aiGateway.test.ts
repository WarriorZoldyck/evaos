import { describe, it, expect } from "vitest";

// Re-implement the pure logic from ai-gateway for validation in node/vitest environment
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
  if (m.includes("pro") || (m.includes("gpt-4o") && !m.includes("mini"))) return "gpt-4o";
  return "gpt-4o-mini";
}

function detectProviderFromKey(key: string): string {
  if (key.startsWith("AIza")) return "gemini";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  return "gemini";
}

function translateContentToGeminiParts(content: any): any[] {
  const parts: any[] = [];
  if (typeof content === "string") {
    if (content.trim()) parts.push({ text: content });
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (!item) continue;
      if (item.type === "text" && item.text) {
        parts.push({ text: item.text });
      } else if (item.type === "image_url" && item.image_url?.url) {
        const match = item.image_url.url.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2].replace(/\s/g, "") } });
        }
      } else if (item.type === "file" && item.file) {
        const fileData = item.file.file_data || "";
        const match = fileData.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2].replace(/\s/g, "") } });
        }
      }
    }
  }
  return parts;
}

describe("AI Gateway Integration", () => {
  describe("Model Normalization", () => {
    it("should strip google/ prefix and normalize WhatsApp model for Gemini", () => {
      expect(normalizeGeminiModel("google/gemini-3-flash-preview")).toBe("gemini-2.5-flash");
      expect(normalizeGeminiModel("google/gemini-2.5-flash")).toBe("gemini-2.5-flash");
      expect(normalizeGeminiModel("google/gemini-2.5-pro")).toBe("gemini-2.5-pro");
      expect(normalizeGeminiModel("gemini-2.5-pro")).toBe("gemini-2.5-pro");
      expect(normalizeGeminiModel(undefined)).toBe("gemini-2.5-flash");
    });

    it("should normalize models for OpenAI", () => {
      expect(normalizeOpenAiModel("google/gemini-2.5-pro")).toBe("gpt-4o");
      expect(normalizeOpenAiModel("google/gemini-3-flash-preview")).toBe("gpt-4o-mini");
      expect(normalizeOpenAiModel("gpt-4o")).toBe("gpt-4o");
      expect(normalizeOpenAiModel("gpt-4o-mini")).toBe("gpt-4o-mini");
    });
  });

  describe("Provider Detection", () => {
    it("should accurately detect provider by API key prefix", () => {
      expect(detectProviderFromKey("AIzaSyB1234567890abcdef")).toBe("gemini");
      expect(detectProviderFromKey("sk-or-v1-abcdef123456")).toBe("openrouter");
      expect(detectProviderFromKey("gsk_abcdef123456")).toBe("groq");
      expect(detectProviderFromKey("sk-proj-abcdef123456")).toBe("openai");
      expect(detectProviderFromKey("sk-abcdef123456")).toBe("openai");
    });
  });

  describe("Multimodal Payload Translation (Gemini Native)", () => {
    it("should convert PDF file payload into Gemini inlineData with application/pdf", () => {
      const dummyPdfBase64 = "JVBERi0xLjQKJcTl8uXrCg==";
      const userContent = [
        {
          type: "file",
          file: {
            filename: "statement.pdf",
            file_data: `data:application/pdf;base64,${dummyPdfBase64}`,
          },
        },
        { type: "text", text: "Extraia todas as transações" },
      ];

      const parts = translateContentToGeminiParts(userContent);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({
        inlineData: {
          mimeType: "application/pdf",
          data: dummyPdfBase64,
        },
      });
      expect(parts[1]).toEqual({ text: "Extraia todas as transações" });
    });

    it("should convert image payload into Gemini inlineData with image/jpeg", () => {
      const dummyImageBase64 = "/9j/4AAQSkZJRgABAQAAAQABAAD";
      const userContent = [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${dummyImageBase64}` },
        },
        { type: "text", text: "Analise este comprovante" },
      ];

      const parts = translateContentToGeminiParts(userContent);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({
        inlineData: {
          mimeType: "image/jpeg",
          data: dummyImageBase64,
        },
      });
      expect(parts[1]).toEqual({ text: "Analise este comprovante" });
    });

    it("should convert audio payload into Gemini inlineData with audio/ogg", () => {
      const dummyAudioBase64 = "T2dnUwACAAAAAAAAAAAAAAA";
      const userContent = [
        {
          type: "file",
          file: {
            filename: "audio.ogg",
            file_data: `data:audio/ogg;base64,${dummyAudioBase64}`,
          },
        },
        { type: "text", text: "Transcreva este áudio" },
      ];

      const parts = translateContentToGeminiParts(userContent);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({
        inlineData: {
          mimeType: "audio/ogg",
          data: dummyAudioBase64,
        },
      });
      expect(parts[1]).toEqual({ text: "Transcreva este áudio" });
    });
  });

  describe("False Encryption Error Logic", () => {
    it("should NOT flag general 400/404 errors as encrypted PDF", () => {
      const errText = "INVALID_ARGUMENT: models/google/gemini-3-flash-preview is not found";
      const isPdfPasswordProtected = /password protected|protected by password|encrypted pdf|decrypt|senha/i.test(errText);
      const isPdfEmpty = /document has no pages|pdf is empty|0 pages/i.test(errText);

      expect(isPdfPasswordProtected).toBe(false);
      expect(isPdfEmpty).toBe(false);
    });

    it("should correctly flag genuine password protected PDF errors", () => {
      const errText = "This document is password protected and cannot be decrypted without a password.";
      const isPdfPasswordProtected = /password protected|protected by password|encrypted pdf|decrypt|senha/i.test(errText);

      expect(isPdfPasswordProtected).toBe(true);
    });
  });
});

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } } | { type: "file"; file: { filename: string; file_data: string } };
type ChatMessage = { role: "user" | "assistant"; content: string | Part[] };

export function validateChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("Histórico inválido");
  return value.map(m => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) throw new Error("Papel de mensagem inválido");
    if (typeof m.content === "string" && m.content.length <= 50000) return { role: m.role, content: m.content };
    if (!Array.isArray(m.content) || m.content.length > 10) throw new Error("Conteúdo inválido");
    const content: Part[] = m.content.map((p: any) => {
      if (p?.type === "text" && typeof p.text === "string" && p.text.length <= 50000) return { type: "text", text: p.text };
      if (p?.type === "image_url" && typeof p.image_url?.url === "string" && /^data:image\/[^;,]+(?:;[^,]*)?;base64,/.test(p.image_url.url) && p.image_url.url.length <= 20_000_000) return { type: "image_url", image_url: { url: p.image_url.url } };
      if (p?.type === "file" && typeof p.file?.filename === "string" && typeof p.file.file_data === "string" && /^data:(audio\/[^;,]+|application\/pdf)(?:;[^,]*)?;base64,/.test(p.file.file_data) && p.file.file_data.length <= 20_000_000) return { type: "file", file: { filename: p.file.filename.slice(0, 200), file_data: p.file.file_data } };
      throw new Error("Anexo inválido");
    });
    return { role: m.role, content };
  });
}
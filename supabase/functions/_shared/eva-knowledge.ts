// Loads user-uploaded "Treinamento da EVA" files (extracted text) to inject into system prompts.
const MAX_CHARS = 20000;

export async function loadKnowledgeBlock(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("eva_knowledge")
      .select("file_name, content, company_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data?.length) return "";
    let out = "";
    for (const f of data) {
      const ctx = f.company_id ? `empresa ${f.company_id}` : "Pessoal";
      const chunk = `\n--- ${f.file_name} (${ctx}) ---\n${f.content}\n`;
      if (out.length + chunk.length > MAX_CHARS) {
        out += chunk.slice(0, Math.max(0, MAX_CHARS - out.length));
        break;
      }
      out += chunk;
    }
    return `\n\nBASE DE CONHECIMENTO DO USUÁRIO (arquivos enviados em Treinamento da EVA). Use estas informações (regras de negócio, preços, procedimentos) para responder dúvidas com precisão; não invente além delas:${out}`;
  } catch (e) {
    console.error("[eva-knowledge] load failed", e);
    return "";
  }
}

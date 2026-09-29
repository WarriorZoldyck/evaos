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
    return `\n\nBASE DE CONHECIMENTO DO USUÁRIO (arquivos enviados em Treinamento da EVA) — PRIORIDADE MÁXIMA:
REGRAS OBRIGATÓRIAS AO USAR ESTA BASE:
1. Esta base é a FONTE PRINCIPAL. Se a resposta estiver aqui, responda com base nela. Os dados do sistema (lançamentos, saldos, contas) servem apenas para complementar, ou quando a pergunta for especificamente sobre os números do usuário.
2. Siga as regras, preços, procedimentos e definições exatamente como o usuário escreveu aqui, mesmo que difiram de padrões genéricos de mercado. Não corrija nem "melhore" o que o usuário definiu.
3. Responda SOMENTE o que foi perguntado, de forma direta e objetiva. Não adicione análises, resumos, alertas ou informações relacionadas que não foram pedidas.
4. Se houver informação adicional relevante (na base ou no sistema), NÃO a entregue agora. No máximo, termine com UMA pergunta curta oferecendo aprofundar (ex.: "Quer que eu mostre como isso fica nos seus números?"). Só traga o detalhe se o usuário pedir.
5. Não invente nada além desta base e dos dados do sistema.${out}`;
  } catch (e) {
    console.error("[eva-knowledge] load failed", e);
    return "";
  }
}

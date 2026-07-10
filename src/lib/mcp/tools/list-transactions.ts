import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_transactions",
  title: "Listar lançamentos",
  description:
    "Lista lançamentos financeiros (receitas/despesas) do usuário autenticado no EVA OS. " +
    "Aceita filtros de intervalo de data de pagamento, tipo e status. Ordenado por data desc.",
  inputSchema: {
    start_date: z.string().describe("Data inicial de payment_date (YYYY-MM-DD). Opcional.").optional(),
    end_date: z.string().describe("Data final de payment_date (YYYY-MM-DD). Opcional.").optional(),
    type: z.enum(["receita", "despesa"]).describe("Filtrar por tipo.").optional(),
    status: z.enum(["Pago", "Pendente"]).describe("Filtrar por status.").optional(),
    limit: z.number().int().min(1).max(200).describe("Máx. de resultados (padrão 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, type, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("transactions")
      .select(
        "id, description, amount, type, status, payment_date, competence_date, category, subcategory, contact_name, bank_account_id, credit_card_id, wallet_id",
      )
      .order("payment_date", { ascending: false })
      .limit(limit ?? 50);
    if (start_date) q = q.gte("payment_date", start_date);
    if (end_date) q = q.lte("payment_date", end_date);
    if (type) q = q.eq("type", type);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { transactions: data ?? [], count: data?.length ?? 0 },
    };
  },
});

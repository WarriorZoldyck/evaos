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
  name: "create_transaction",
  title: "Criar lançamento",
  description:
    "Cria um lançamento (receita ou despesa) no EVA OS para o usuário autenticado. " +
    "Vincule a uma conta bancária, cartão ou carteira usando list_accounts para obter o ID.",
  inputSchema: {
    description: z.string().min(1).describe("Descrição do lançamento."),
    amount: z.number().positive().describe("Valor absoluto (positivo)."),
    type: z.enum(["receita", "despesa"]).describe("Tipo do lançamento."),
    payment_date: z.string().describe("Data de pagamento (YYYY-MM-DD)."),
    status: z.enum(["Pago", "Pendente"]).describe("Status. Padrão: Pago.").optional(),
    category: z.string().describe("Categoria (texto livre ou UUID de categoria).").optional(),
    contact_name: z.string().describe("Nome do contato/fornecedor/cliente.").optional(),
    notes: z.string().describe("Observações.").optional(),
    bank_account_id: z.string().uuid().describe("ID da conta bancária.").optional(),
    credit_card_id: z.string().uuid().describe("ID do cartão de crédito.").optional(),
    wallet_id: z.string().uuid().describe("ID da carteira.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: ctx.getUserId(),
        description: input.description,
        amount: input.amount,
        type: input.type,
        payment_date: input.payment_date,
        competence_date: input.payment_date,
        status: input.status ?? "Pago",
        category: input.category ?? null,
        contact_name: input.contact_name ?? null,
        notes: input.notes ?? null,
        bank_account_id: input.bank_account_id ?? null,
        credit_card_id: input.credit_card_id ?? null,
        wallet_id: input.wallet_id ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Lançamento criado: ${data.id}` }],
      structuredContent: { transaction: data },
    };
  },
});

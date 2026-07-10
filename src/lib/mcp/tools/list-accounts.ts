import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_accounts",
  title: "Listar contas",
  description:
    "Lista todas as contas do usuário: contas bancárias, cartões de crédito e carteiras. " +
    "Retorna os IDs necessários para create_transaction.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [banks, cards, wallets] = await Promise.all([
      supabase.from("bank_accounts").select("id, name, bank_name, initial_balance"),
      supabase.from("credit_cards").select("id, name, brand, closing_day, due_day"),
      supabase.from("wallets").select("id, name, initial_balance"),
    ]);
    const payload = {
      bank_accounts: banks.data ?? [],
      credit_cards: cards.data ?? [],
      wallets: wallets.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

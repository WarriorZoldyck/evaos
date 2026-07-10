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
  name: "financial_summary",
  title: "Resumo financeiro",
  description:
    "Retorna resumo financeiro do período: total de receitas, despesas, saldo, e breakdown por categoria. " +
    "Considera apenas lançamentos com status Pago.",
  inputSchema: {
    start_date: z.string().describe("Data inicial do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Data final do período (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("transactions")
      .select("amount, type, category")
      .eq("status", "Pago")
      .gte("payment_date", start_date)
      .lte("payment_date", end_date)
      .limit(5000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let receitas = 0;
    let despesas = 0;
    const byCategory: Record<string, { receita: number; despesa: number }> = {};
    for (const t of data ?? []) {
      const amount = Number(t.amount) || 0;
      const cat = t.category || "Sem categoria";
      byCategory[cat] ??= { receita: 0, despesa: 0 };
      if (t.type === "receita") {
        receitas += amount;
        byCategory[cat].receita += amount;
      } else {
        despesas += amount;
        byCategory[cat].despesa += amount;
      }
    }
    const summary = {
      period: { start_date, end_date },
      totals: {
        receitas: Number(receitas.toFixed(2)),
        despesas: Number(despesas.toFixed(2)),
        saldo: Number((receitas - despesas).toFixed(2)),
      },
      by_category: Object.entries(byCategory)
        .map(([category, v]) => ({
          category,
          receita: Number(v.receita.toFixed(2)),
          despesa: Number(v.despesa.toFixed(2)),
        }))
        .sort((a, b) => b.despesa + b.receita - (a.despesa + a.receita)),
      transaction_count: data?.length ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});

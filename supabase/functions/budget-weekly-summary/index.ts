import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBudgetMonthReport,
  formatBudgetMonthMessage,
} from "../_shared/budgetMonthReport.ts";

/**
 * Resumo semanal das metas orçamentárias (cron: segundas de manhã).
 * Só envia para usuários que já definiram pelo menos uma meta.
 */

const evoUrl = Deno.env.get("EVOLUTION_API_URL");
const evoKey = Deno.env.get("EVOLUTION_API_KEY");
const evoInstance = Deno.env.get("EVOLUTION_INSTANCE");

async function sendText(phone: string, text: string) {
  const url = `${evoUrl}/message/sendText/${encodeURIComponent(evoInstance!)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: evoKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Autorização: chave de admin (cron / execução manual).
  const adminKey = Deno.env.get("BROADCAST_ADMIN_KEY");
  const apikeyHeader = req.headers.get("apikey");
  const isCron = !!apikeyHeader && apikeyHeader === Deno.env.get("SUPABASE_ANON_KEY");
  if (!isCron && (!adminKey || req.headers.get("x-admin-key") !== adminKey)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!evoUrl || !evoKey || !evoInstance) {
    return new Response(JSON.stringify({ error: "evolution_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch (_) {
    // sem corpo (cron manda { time })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: targets, error } = await supabase
    .from("budget_targets")
    .select("user_id");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userIds = Array.from(new Set((targets ?? []).map((t: any) => t.user_id)));
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped: "no_targets" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp_number")
    .in("id", userIds)
    .not("whatsapp_number", "is", null);

  const results: { user_id: string; ok: boolean; error?: string }[] = [];

  for (const p of profiles ?? []) {
    const digits = String(p.whatsapp_number ?? "").replace(/\D/g, "");
    if (digits.length < 10) continue;
    const phone = digits.startsWith("55") ? digits : `55${digits}`;

    try {
      // Consolidado (sem filtro de contexto) para o resumo semanal.
      const report = await buildBudgetMonthReport(supabase, p.id, undefined);
      if (!report.hasData) continue;

      const first = (p.full_name || "").split(" ")[0];
      const header = first ? `Bom dia, ${first}! ` : "Bom dia! ";
      const message = `${header}Aqui está o acompanhamento das suas metas 👇\n\n${formatBudgetMonthMessage(report)}`;

      if (!body.dry_run) {
        await sendText(phone, message);
        await supabase.from("whatsapp_messages").insert({
          user_id: p.id,
          role: "assistant",
          content: message,
        });
      }
      results.push({ user_id: p.id, ok: true });
    } catch (err) {
      results.push({ user_id: p.id, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  return new Response(
    JSON.stringify({
      dry_run: !!body.dry_run,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

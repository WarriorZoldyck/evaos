const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "npm:@supabase/supabase-js@2";

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

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const adminKey = Deno.env.get("BROADCAST_ADMIN_KEY");
  if (!adminKey || req.headers.get("x-admin-key") !== adminKey) {
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
  } catch (_) {}

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp_number, whatsapp_reminders_enabled, whatsapp_reminders_days")
    .eq("whatsapp_reminders_enabled", true)
    .not("whatsapp_number", "is", null);

  if (profilesError || !profiles) {
    return new Response(JSON.stringify({ error: profilesError?.message || "No profiles found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];
  const now = new Date();
  const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const today = new Date(brazilTime);
  today.setUTCHours(0, 0, 0, 0); // Consider today's date at midnight UTC

  for (const profile of profiles) {
    const daysBeforeArr = profile.whatsapp_reminders_days || [];
    if (daysBeforeArr.length === 0) continue;

    const digits = String(profile.whatsapp_number).replace(/\D/g, "");
    if (digits.length < 10) continue;
    const phone = digits.startsWith("55") ? digits : `55${digits}`;

    // Compute dates to check
    const datesToCheck = daysBeforeArr.map((days: number) => {
      const d = new Date(today.getTime());
      d.setUTCDate(d.getUTCDate() + days);
      return { 
        days, 
        dateStr: d.toISOString().split("T")[0] 
      };
    });

    const targetDates = datesToCheck.map(d => d.dateStr);

    // Get transactions for this user
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, description, amount, payment_date")
      .eq("user_id", profile.id)
      .eq("type", "despesa")
      .eq("status", "Pendente")
      .in("payment_date", targetDates);

    if (txError || !transactions || transactions.length === 0) {
      continue;
    }

    const firstName = profile.full_name ? profile.full_name.split(" ")[0] : "Usuário";
    let message = `Olá ${firstName}! 👋\n\nVocê tem as seguintes contas próximas do vencimento:\n\n`;

    transactions.forEach(tx => {
      // Find how many days left
      const txDateObj = datesToCheck.find(d => d.dateStr === tx.payment_date);
      const daysLeft = txDateObj ? txDateObj.days : null;
      let dayText = "";
      if (daysLeft === 0) dayText = "*(VENCE HOJE)*";
      else if (daysLeft === 1) dayText = "*(VENCE AMANHÃ)*";
      else dayText = `*(Vence em ${daysLeft} dias)*`;

      message += `💸 ${tx.description}\n`;
      message += `💰 Valor: ${formatBRL(tx.amount)}\n`;
      message += `📅 Data: ${tx.payment_date} ${dayText}\n\n`;
    });

    message += `Não se esqueça de acessar o aplicativo para mais detalhes!`;

    try {
      if (!body.dry_run) {
        await sendText(phone, message);
        await supabase.from("whatsapp_messages").insert({
          user_id: profile.id,
          role: "assistant",
          content: message,
        });
      }
      results.push({ user_id: profile.id, ok: true, txCount: transactions.length });
    } catch (err) {
      results.push({ user_id: profile.id, ok: false, error: String(err) });
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
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

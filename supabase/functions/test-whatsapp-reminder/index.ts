const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "npm:@supabase/supabase-js@2";
import { collectUserReminders, formatReminderMessage } from "../_shared/whatsappReminders.ts";

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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!evoUrl || !evoKey || !evoInstance) {
      throw new Error("Evolution API não configurada.");
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("whatsapp_number, full_name, whatsapp_reminders_days, whatsapp_reminders_time")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.whatsapp_number) {
      throw new Error("Número de WhatsApp não configurado no perfil.");
    }

    const phone = profile.whatsapp_number.replace(/\D/g, "");
    if (phone.length < 10) {
      throw new Error("Número de WhatsApp inválido.");
    }
    const normalizedPhone = phone.startsWith("55") ? phone : `55${phone}`;

    const firstName = profile.full_name ? profile.full_name.trim().split(" ")[0] : "Usuário";

    // Data de hoje no fuso do Brasil
    const now = new Date();
    const brazilDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayDateStr = brazilDateFormatter.format(now); // "YYYY-MM-DD"

    const daysBeforeArr = (profile.whatsapp_reminders_days && profile.whatsapp_reminders_days.length > 0)
      ? profile.whatsapp_reminders_days
      : [0, 1, 3];

    const [y, m, d] = todayDateStr.split("-").map(Number);
    const targetDatesInfo = daysBeforeArr.map((daysAhead: number) => {
      const targetDate = new Date(Date.UTC(y, m - 1, d + Number(daysAhead)));
      const dateStr = targetDate.toISOString().split("T")[0];
      return { days: Number(daysAhead), dateStr };
    });

    const collected = await collectUserReminders(supabaseClient, user.id, targetDatesInfo);
    const message = formatReminderMessage(firstName, collected, targetDatesInfo, {
      isTest: true,
      daysBeforeArr,
      configuredTime: profile.whatsapp_reminders_time || "09:00",
    });

    let body: { dry_run?: boolean } = {};
    try {
      body = await req.json();
    } catch (_) {}

    if (!body.dry_run) {
      await sendText(normalizedPhone, message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: !!body.dry_run,
        count: collected.totalItems,
        invoices: collected.invoices.length,
        bills: collected.bills.length,
        preview_message: message,
        message: "Mensagens enviadas com sucesso!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
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

  const adminKey = Deno.env.get("BROADCAST_ADMIN_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecretEnv = Deno.env.get("CRON_SECRET");

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const adminKeyHeader = req.headers.get("x-admin-key");

  const isAuthorized =
    (adminKey && (adminKeyHeader === adminKey || token === adminKey)) ||
    (serviceRoleKey && token === serviceRoleKey) ||
    (cronSecretEnv && cronSecretHeader === cronSecretEnv);

  if (!isAuthorized) {
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

  let body: { dry_run?: boolean; force?: boolean; user_id?: string; all_with_phone?: boolean; window_days?: number } = {};
  try {
    body = await req.json();
  } catch (_) {}

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Computa a data e horário atual no Brasil (Fuso horário de Brasília - UTC-3)
  const now = new Date();
  const brazilDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayDateStr = brazilDateFormatter.format(now); // "YYYY-MM-DD"

  const brazilTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const currentHourMinute = brazilTimeFormatter.format(now);
  const currentHour = parseInt(currentHourMinute.split(":")[0], 10);

  const dayOfWeekFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  });
  const dayOfWeek = dayOfWeekFormatter.format(now);
  const isWeekend = dayOfWeek === "Sat" || dayOfWeek === "Sun";

  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, whatsapp_number, whatsapp_reminders_enabled, whatsapp_reminders_days, whatsapp_reminders_time, whatsapp_reminders_weekdays_only, whatsapp_reminders_last_sent_date")
    .not("whatsapp_number", "is", null);
  if (!(body.all_with_phone && body.force)) {
    profilesQuery = profilesQuery.eq("whatsapp_reminders_enabled", true);
  }

  if (body.user_id) {
    profilesQuery = profilesQuery.eq("id", body.user_id);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError || !profiles) {
    return new Response(JSON.stringify({ error: profilesError?.message || "No profiles found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const profile of profiles) {
    // 1. Verifica se usuário prefere apenas dias úteis
    if (profile.whatsapp_reminders_weekdays_only && isWeekend && !body.force) {
      results.push({ user_id: profile.id, skipped: "weekend" });
      continue;
    }

    // 2. Horário configurado pelo usuário (padrão: 09:00)
    const userTimeStr = profile.whatsapp_reminders_time || "09:00";
    const userHour = parseInt(userTimeStr.split(":")[0], 10) || 9;

    if (!body.force) {
      if (profile.whatsapp_reminders_last_sent_date === todayDateStr) {
        results.push({ user_id: profile.id, skipped: "already_sent_today" });
        continue;
      }

      if (currentHour < userHour) {
        results.push({ user_id: profile.id, skipped: `scheduled_at_${userTimeStr}_current_${currentHourMinute}` });
        continue;
      }
    }

    const windowDays = Math.min(Math.max(Number(body.window_days) || 0, 0), 15);
    const daysBeforeArr = windowDays > 0
      ? Array.from({ length: windowDays + 1 }, (_, i) => i)
      : (profile.whatsapp_reminders_days && profile.whatsapp_reminders_days.length > 0)
        ? profile.whatsapp_reminders_days
        : [0, 1, 3];

    const digits = String(profile.whatsapp_number).replace(/\D/g, "");
    if (digits.length < 10) {
      results.push({ user_id: profile.id, skipped: "invalid_phone" });
      continue;
    }
    const phone = digits.startsWith("55") ? digits : `55${digits}`;

    const [y, m, d] = todayDateStr.split("-").map(Number);
    const targetDatesInfo = daysBeforeArr.map((daysAhead: number) => {
      const targetDate = new Date(Date.UTC(y, m - 1, d + Number(daysAhead)));
      const dateStr = targetDate.toISOString().split("T")[0];
      return { days: Number(daysAhead), dateStr };
    });

    const collected = await collectUserReminders(supabase, profile.id, targetDatesInfo);

    if (collected.totalItems === 0) {
      if (!body.dry_run) {
        await supabase
          .from("profiles")
          .update({ whatsapp_reminders_last_sent_date: todayDateStr })
          .eq("id", profile.id);
      }
      results.push({ user_id: profile.id, ok: true, txCount: 0, skipped: "no_bills_due" });
      continue;
    }

    const firstName = profile.full_name ? profile.full_name.trim().split(" ")[0] : "Usuário";
    const message = formatReminderMessage(firstName, collected, targetDatesInfo);

    try {
      if (!body.dry_run) {
        await sendText(phone, message);
        await supabase.from("whatsapp_messages").insert({
          user_id: profile.id,
          role: "assistant",
          content: message,
        });
        await supabase
          .from("profiles")
          .update({ whatsapp_reminders_last_sent_date: todayDateStr })
          .eq("id", profile.id);
      }
      results.push({
        user_id: profile.id,
        ok: true,
        txCount: collected.totalItems,
        invoices: collected.invoices.length,
        bills: collected.bills.length,
        ...(body.dry_run ? { preview_message: message } : {}),
      });
    } catch (err) {
      results.push({ user_id: profile.id, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  return new Response(
    JSON.stringify({
      brazil_date: todayDateStr,
      brazil_time: currentHourMinute,
      dry_run: !!body.dry_run,
      sent: results.filter((r) => r.ok && (r.txCount ?? 0) > 0).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.ok && !r.skipped).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
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
      // Já enviado hoje? Pula para não duplicar
      if (profile.whatsapp_reminders_last_sent_date === todayDateStr) {
        results.push({ user_id: profile.id, skipped: "already_sent_today" });
        continue;
      }

      // Ainda não chegou o horário configurado pelo usuário
      if (currentHour < userHour) {
        results.push({ user_id: profile.id, skipped: `scheduled_at_${userTimeStr}_current_${currentHourMinute}` });
        continue;
      }
    }

    const windowDays = Math.min(Math.max(Number(body.window_days) || 0, 0), 15);
    const daysBeforeArr = windowDays > 0 ? Array.from({ length: windowDays + 1 }, (_, i) => i) : (profile.whatsapp_reminders_days && profile.whatsapp_reminders_days.length > 0)
      ? profile.whatsapp_reminders_days
      : [0, 1, 3];

    const digits = String(profile.whatsapp_number).replace(/\D/g, "");
    if (digits.length < 10) {
      results.push({ user_id: profile.id, skipped: "invalid_phone" });
      continue;
    }
    const phone = digits.startsWith("55") ? digits : `55${digits}`;

    // Computa datas alvo
    const [y, m, d] = todayDateStr.split("-").map(Number);
    const targetDatesInfo = daysBeforeArr.map((daysAhead: number) => {
      const targetDate = new Date(Date.UTC(y, m - 1, d + Number(daysAhead)));
      const dateStr = targetDate.toISOString().split("T")[0];
      return { days: Number(daysAhead), dateStr };
    });
    const targetDates = targetDatesInfo.map((t: any) => t.dateStr);

    // 1. Busca lançamentos pontuais pendentes
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, description, amount, payment_date")
      .eq("user_id", profile.id)
      .eq("type", "despesa")
      .eq("status", "Pendente")
      .in("payment_date", targetDates)
      .order("payment_date", { ascending: true });

    // 2. Busca despesas recorrentes ativas
    const { data: recurringList } = await supabase
      .from("recurring_transactions")
      .select("id, description, amount, type, frequency, start_date, end_date, day_of_month")
      .eq("user_id", profile.id)
      .eq("type", "despesa");

    const allBills: { description: string; amount: number; payment_date: string; isRecurring?: boolean }[] = [
      ...(transactions || []),
    ];

    if (recurringList && recurringList.length > 0) {
      for (const rec of recurringList) {
        for (const target of targetDatesInfo) {
          const tDate = new Date(target.dateStr + "T00:00:00");
          const sDate = new Date(rec.start_date + "T00:00:00");
          if (tDate < sDate) continue;
          if (rec.end_date) {
            const eDate = new Date(rec.end_date + "T00:00:00");
            if (tDate > eDate) continue;
          }

          let matches = false;
          if (rec.frequency === "monthly") {
            const targetDay = rec.day_of_month || sDate.getDate();
            const daysInMonth = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0).getDate();
            if (tDate.getDate() === Math.min(targetDay, daysInMonth)) {
              matches = true;
            }
          } else if (rec.frequency === "daily") {
            matches = true;
          } else if (rec.frequency === "weekly") {
            matches = (tDate.getTime() - sDate.getTime()) % (7 * 86400000) === 0;
          }

          if (matches) {
            const alreadyExists = allBills.some(
              (b) => b.payment_date === target.dateStr && b.description.toLowerCase().trim() === rec.description.toLowerCase().trim()
            );
            if (!alreadyExists) {
              allBills.push({
                description: rec.description,
                amount: rec.amount,
                payment_date: target.dateStr,
                isRecurring: true,
              });
            }
          }
        }
      }
    }

    // Se não há contas para os dias configurados
    if (allBills.length === 0) {
      if (!body.dry_run) {
        await supabase
          .from("profiles")
          .update({ whatsapp_reminders_last_sent_date: todayDateStr })
          .eq("id", profile.id);
      }
      results.push({ user_id: profile.id, ok: true, txCount: 0, skipped: "no_bills_due" });
      continue;
    }

    allBills.sort((a, b) => a.payment_date.localeCompare(b.payment_date));

    const firstName = profile.full_name ? profile.full_name.trim().split(" ")[0] : "Usuário";
    let message = `Olá, ${firstName}! 👋\n\n`;
    message += `Passando para te lembrar das suas próximas contas a vencer:\n\n`;

    allBills.forEach((bill) => {
      const match = targetDatesInfo.find((t: any) => t.dateStr === bill.payment_date);
      const daysLeft = match ? match.days : null;
      let dayBadge = "";
      if (daysLeft === 0) dayBadge = "🚨 *(VENCE HOJE)*";
      else if (daysLeft === 1) dayBadge = "⚠️ *(VENCE AMANHÃ)*";
      else dayBadge = `📅 *(Vence em ${daysLeft} dias)*`;

      const [by, bm, bd] = bill.payment_date.split("-");
      const formattedDate = `${bd}/${bm}/${by}`;

      message += `💸 *${bill.description}*\n`;
      message += `💰 Valor: ${formatBRL(bill.amount)}\n`;
      message += `🗓️ Vencimento: ${formattedDate} ${dayBadge}\n\n`;
    });

    message += `💡 Acesse o EVA OS para conferir ou liquidar seus lançamentos!`;

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
      results.push({ user_id: profile.id, ok: true, txCount: allBills.length });
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

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
      const targetDate = new Date(Date.UTC(y, m - 1, d + daysAhead));
      const dateStr = targetDate.toISOString().split("T")[0];
      return { days: daysAhead, dateStr };
    });
    const targetDates = targetDatesInfo.map((t: any) => t.dateStr);

    // 1. Busca lançamentos pontuais pendentes
    const { data: transactions, error: txError } = await supabaseClient
      .from("transactions")
      .select("id, description, amount, payment_date")
      .eq("user_id", user.id)
      .eq("type", "despesa")
      .eq("status", "Pendente")
      .in("payment_date", targetDates)
      .order("payment_date", { ascending: true });

    if (txError) {
      throw new Error("Erro ao buscar lançamentos: " + txError.message);
    }

    // 2. Busca despesas recorrentes
    const { data: recurringList } = await supabaseClient
      .from("recurring_transactions")
      .select("id, description, amount, type, frequency, start_date, end_date, day_of_month")
      .eq("user_id", user.id)
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

    allBills.sort((a, b) => a.payment_date.localeCompare(b.payment_date));

    let message = `Olá, ${firstName}! 👋 *(Teste de Lembrete)*\n\n`;

    if (allBills.length === 0) {
      message += `Tudo certo por aqui! Você não possui despesas pendentes com vencimento nos dias configurados no seu lembrete (${daysBeforeArr.map((d: number) => d === 0 ? "no dia" : `${d}d antes`).join(", ")}). 🚀\n\nQuando houver contas a vencer, a EVA enviará o resumo para você automaticamente no horário configurado (${profile.whatsapp_reminders_time || "09:00"})!`;
    } else {
      message += `Você tem as seguintes contas próximas do vencimento:\n\n`;

      allBills.forEach((bill: any) => {
        const match = targetDatesInfo.find((d: any) => d.dateStr === bill.payment_date);
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
    }

    await sendText(normalizedPhone, message);

    return new Response(JSON.stringify({ success: true, count: allBills.length, message: "Mensagens enviadas com sucesso!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

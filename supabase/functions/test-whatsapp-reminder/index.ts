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
      .select("whatsapp_number, full_name, whatsapp_reminders_days")
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

    const firstName = profile.full_name ? profile.full_name.split(" ")[0] : "Usuário";

    // Busca as contas que estão configuradas para vencer nos dias do lembrete
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const daysBeforeArr = profile.whatsapp_reminders_days || [0, 1, 3]; // fallback

    const datesToCheck = daysBeforeArr.map((days: number) => {
      const d = new Date(today.getTime());
      d.setUTCDate(d.getUTCDate() + days);
      return { 
        days, 
        dateStr: d.toISOString().split("T")[0] 
      };
    });

    const targetDates = datesToCheck.map((d: any) => d.dateStr);

    const { data: transactions, error: txError } = await supabaseClient
      .from("transactions")
      .select("id, description, amount, payment_date")
      .eq("user_id", user.id)
      .eq("type", "despesa")
      .eq("status", "Pendente")
      .in("payment_date", targetDates);

    if (txError) {
      throw new Error("Erro ao buscar lançamentos: " + txError.message);
    }

    let message = `Olá ${firstName}! 👋\n\n`;

    if (!transactions || transactions.length === 0) {
      message += `Tudo certo por aqui! Você não tem contas próximas do vencimento para os dias configurados no lembrete. 🚀`;
    } else {
      message += `Você tem as seguintes contas próximas do vencimento:\n\n`;

      transactions.forEach((tx: any) => {
        const txDateObj = datesToCheck.find((d: any) => d.dateStr === tx.payment_date);
        const daysLeft = txDateObj ? txDateObj.days : null;
        let dayText = "";
        if (daysLeft === 0) dayText = "*(VENCE HOJE)*";
        else if (daysLeft === 1) dayText = "*(VENCE AMANHÃ)*";
        else dayText = `*(Vence em ${daysLeft} dias)*`;

        message += `💸 ${tx.description}\n`;
        message += `💰 Valor: ${formatBRL(tx.amount)}\n`;
        message += `📅 Data: ${tx.payment_date.split("-").reverse().join("/")} ${dayText}\n\n`;
      });

      message += `Não se esqueça de acessar o aplicativo para mais detalhes!`;
    }

    await sendText(normalizedPhone, message);

    return new Response(JSON.stringify({ success: true, message: "Mensagens enviadas com sucesso!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
      .select("whatsapp_number, full_name")
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
    
    const message = `Olá ${firstName}! 👋\n\nEste é um lembrete de teste do sistema EVA. Quando houver contas próximas do vencimento, você será avisado por aqui! 🚀`;

    await sendText(normalizedPhone, message);

    return new Response(JSON.stringify({ success: true, message: "Mensagem de teste enviada!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

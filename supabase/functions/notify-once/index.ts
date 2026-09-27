import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ONE_TIME_KEY = "vitor-upd-7f3k29qz";
const USER_ID = "3bde8282-526e-4ef4-b262-64c9e205c355";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.headers.get("x-once-key") !== ONE_TIME_KEY) return json({ error: "unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p } = await sb.from("profiles").select("full_name, whatsapp_number").eq("id", USER_ID).single();
  const digits = String(p?.whatsapp_number ?? "").replace(/\D/g, "");
  if (digits.length < 10) return json({ error: "no_whatsapp" }, 400);
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  const first = (p?.full_name ?? "Vitor").split(" ")[0];
  const text = `Olá, ${first}! Fizemos uma atualização no EVA OS: seus lançamentos de cartão antigos agora aparecem ligados à conta que paga a fatura. Assim, os filtros por conta e o valor de "Pagar fatura" passam a bater. Nenhum valor foi alterado. Qualquer dúvida, é só responder aqui.`;

  const res = await fetch(`${Deno.env.get("EVOLUTION_API_URL")}/message/sendText/${encodeURIComponent(Deno.env.get("EVOLUTION_INSTANCE")!)}`, {
    method: "POST",
    headers: { apikey: Deno.env.get("EVOLUTION_API_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text }),
  });
  const body = await res.text();
  if (!res.ok) return json({ error: "send_failed", status: res.status, details: body }, 502);
  await sb.from("whatsapp_messages").insert({ user_id: USER_ID, role: "assistant", content: text });
  return json({ ok: true });
});

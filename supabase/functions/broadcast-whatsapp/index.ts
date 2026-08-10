import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
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

  let body: { message?: string; dry_run?: boolean; only?: string[] } = {};
  try {
    body = await req.json();
  } catch (_) {
    // ignore
  }
  const message = (body.message ?? "").trim();
  if (message.length < 5 || message.length > 4000) {
    return new Response(JSON.stringify({ error: "invalid_message" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const p of data ?? []) {
    const digits = String(p.whatsapp_number ?? "").replace(/\D/g, "");
    if (digits.length < 10) continue;
    const normalized = digits.startsWith("55") ? digits : `55${digits}`;
    if (seen.has(normalized)) continue;
    if (body.only && body.only.length > 0 && !body.only.some((o) => normalized.endsWith(o.replace(/\D/g, "")))) continue;
    seen.add(normalized);
    recipients.push(normalized);
  }

  if (body.dry_run) {
    return new Response(JSON.stringify({ dry_run: true, count: recipients.length, recipients }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { phone: string; ok: boolean; error?: string }[] = [];
  for (const phone of recipients) {
    try {
      await sendText(phone, message);
      results.push({ phone, ok: true });
    } catch (err) {
      results.push({ phone, ok: false, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  return new Response(
    JSON.stringify({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

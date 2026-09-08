import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const evoUrl = Deno.env.get("EVOLUTION_API_URL");
const evoKey = Deno.env.get("EVOLUTION_API_KEY");
const evoInstance = Deno.env.get("EVOLUTION_INSTANCE");

// One-off broadcast helper. Guarded by a static token and meant to be
// deleted right after the announcement is sent.
const ONE_OFF_TOKEN = "eva-broadcast-2026-09-08-x71qm";

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

  let body: { token?: string; message?: string; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch (_) {
    // ignore
  }

  if (body.token !== ONE_OFF_TOKEN) {
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

  const message = (body.message ?? "").trim();
  if (message.length < 5) {
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
  const recipients: { phone: string; name: string }[] = [];
  for (const p of data ?? []) {
    const digits = String(p.whatsapp_number ?? "").replace(/\D/g, "");
    if (digits.length < 10) continue;
    const normalized = digits.startsWith("55") ? digits : `55${digits}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push({ phone: normalized, name: String(p.full_name ?? "").split(" ")[0] ?? "" });
  }

  if (body.dry_run) {
    return new Response(JSON.stringify({ dry_run: true, count: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { phone: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    const text = r.name ? `Oi, ${r.name}! ${message}` : message;
    try {
      await sendText(r.phone, text);
      results.push({ phone: r.phone, ok: true });
    } catch (err) {
      results.push({ phone: r.phone, ok: false, error: String(err) });
    }
    await new Promise((res) => setTimeout(res, 1200));
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

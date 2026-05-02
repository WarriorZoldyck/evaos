import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redactSecrets(value: unknown, secret: string): unknown {
  if (typeof value === 'string') {
    let redacted = value.replace(/([?&]secret=)[^&\s"']+/gi, '$1[REDACTED]');
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
    return redacted;
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secret));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /secret|apikey|api_key|authorization|token/i.test(key) ? '[REDACTED]' : redactSecrets(item, secret),
      ]),
    );
  }
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Auth check: require authenticated user ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');
  const WHATSAPP_WEBHOOK_SECRET = Deno.env.get('WHATSAPP_WEBHOOK_SECRET') || '';

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return jsonResponse({ error: 'Missing Evolution API secrets' }, 500);
  }

  // Build webhook URL dynamically from SUPABASE_URL.
  // Append ?secret= as a fallback for providers that cannot set custom headers.
  const baseFnUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  const webhookUrl = WHATSAPP_WEBHOOK_SECRET
    ? `${baseFnUrl}?secret=${encodeURIComponent(WHATSAPP_WEBHOOK_SECRET)}`
    : baseFnUrl;

  try {
    if (req.method === 'GET') {
      const res = await fetch(`${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse({
        status: res.status,
        expected_webhook_url: baseFnUrl,
        evolution_instance: EVOLUTION_INSTANCE,
        secret_configured: !!WHATSAPP_WEBHOOK_SECRET,
        data: redactSecrets(data, WHATSAPP_WEBHOOK_SECRET),
      });
    }

    if (req.method === 'POST') {
      const payload = {
        webhook: {
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          enabled: true,
          headers: WHATSAPP_WEBHOOK_SECRET
            ? { 'x-webhook-secret': WHATSAPP_WEBHOOK_SECRET, 'content-type': 'application/json' }
            : { 'content-type': 'application/json' },
          events: ['MESSAGES_UPSERT'],
        },
      };

      const res = await fetch(`${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      console.log('Evolution webhook/set response:', res.status, JSON.stringify(data).slice(0, 500));
      return jsonResponse({
        status: res.status,
        ok: res.ok,
        webhook_url: baseFnUrl,
        secret_configured: !!WHATSAPP_WEBHOOK_SECRET,
        data: redactSecrets(data, WHATSAPP_WEBHOOK_SECRET),
        configured_events: payload.webhook.events,
      });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('evolution-webhook-config error:', message);
    return jsonResponse({ error: message }, 500);
  }
});

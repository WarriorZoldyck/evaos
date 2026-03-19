import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return new Response(JSON.stringify({ error: 'Missing Evolution API secrets' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    if (req.method === 'GET') {
      // Consultar configuração atual do webhook
      const res = await fetch(`${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Atualizar webhook com MESSAGES_UPSERT
      const webhookUrl = `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook`;
      
      const payload = {
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        enabled: true,
        events: [
          "MESSAGES_UPSERT"
        ]
      };

      const res = await fetch(`${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify({ status: res.status, data, payload }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

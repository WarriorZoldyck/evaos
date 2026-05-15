import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY")!;
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "EVA OS",
      access_token: apiKey,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Asaas error", path, res.status, data);
    throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { plan_slug, billing_cycle } = body;
    if (!plan_slug) {
      return new Response(JSON.stringify({ error: "plan_slug obrigatório" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Assinatura ativa
    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub || !sub.asaas_subscription_id) {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura ativa para alterar" }), { status: 404, headers: corsHeaders });
    }

    // Novo plano
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: corsHeaders });
    }

    if (plan.id === sub.plan_id && (!billing_cycle || billing_cycle === sub.billing_cycle)) {
      return new Response(JSON.stringify({ error: "Você já está neste plano" }), { status: 400, headers: corsHeaders });
    }

    const cycleChoice: "monthly" | "yearly" =
      billing_cycle === "yearly" || billing_cycle === "monthly"
        ? billing_cycle
        : (sub.billing_cycle as "monthly" | "yearly") || "monthly";

    const baseCents = cycleChoice === "yearly"
      ? (plan.yearly_price_cents ?? plan.price_cents * 12)
      : plan.price_cents;

    // Mantém desconto vigente (discount_percent) se houver
    const discountPct = Number(sub.discount_percent || 0);
    const finalCents = Math.round(baseCents * (1 - discountPct / 100));
    const finalValue = finalCents / 100;
    const asaasCycle = cycleChoice === "yearly" ? "YEARLY" : "MONTHLY";

    // Atualiza Asaas — mantém nextDueDate (ajuste vale a partir do próximo vencimento)
    await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}`, {
      method: "POST",
      body: JSON.stringify({
        value: finalValue,
        cycle: asaasCycle,
        description: `EVA OS — Plano ${plan.name} (${cycleChoice === "yearly" ? "Anual" : "Mensal"})`,
        updatePendingPayments: false,
      }),
    });

    const { data: updated, error: upErr } = await admin
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        billing_cycle: cycleChoice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .select()
      .single();

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ subscription: updated, message: "Plano alterado. Novo valor vale a partir do próximo vencimento." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

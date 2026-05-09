import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }

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
    const userEmail = claims.claims.email as string | undefined;

    const body = await req.json();
    const { plan_slug, billing_type, cpf_cnpj, name, phone, billing_cycle, coupon_code } = body;

    if (!plan_slug || !billing_type || !cpf_cnpj || !name) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), { status: 400, headers: corsHeaders });
    }
    if (!["CREDIT_CARD", "PIX", "BOLETO", "UNDEFINED"].includes(billing_type)) {
      return new Response(JSON.stringify({ error: "Método inválido" }), { status: 400, headers: corsHeaders });
    }
    const cycleChoice: "monthly" | "yearly" = billing_cycle === "yearly" ? "yearly" : "monthly";
    const cpfDigits = onlyDigits(cpf_cnpj);
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ inválido" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Plan
    const { data: plan, error: planErr } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: corsHeaders });
    }

    // 2. Bloquear se já tem assinatura ativa
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Você já possui uma assinatura ativa" }), { status: 409, headers: corsHeaders });
    }

    // 3. Preço base
    const cycleMultiplier = cycleChoice === "yearly" ? 12 : 1;
    const baseCents = plan.price_cents * cycleMultiplier;
    const asaasCycle = cycleChoice === "yearly" ? "YEARLY" : "MONTHLY";

    // 3.1 Cupom (opcional)
    let appliedCoupon: any = null;
    let discountCents = 0;
    if (coupon_code && typeof coupon_code === "string" && coupon_code.trim()) {
      const codeNorm = coupon_code.trim().toUpperCase();
      const { data: coupon } = await admin
        .from("subscription_coupons")
        .select("*")
        .eq("code", codeNorm)
        .eq("is_active", true)
        .maybeSingle();
      if (!coupon) {
        return new Response(JSON.stringify({ error: "Cupom inválido" }), { status: 400, headers: corsHeaders });
      }
      if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Cupom expirado" }), { status: 400, headers: corsHeaders });
      }
      if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
        return new Response(JSON.stringify({ error: "Cupom esgotado" }), { status: 400, headers: corsHeaders });
      }
      if (coupon.applies_to_plan_slug && coupon.applies_to_plan_slug !== plan_slug) {
        return new Response(JSON.stringify({ error: "Cupom não vale para este plano" }), { status: 400, headers: corsHeaders });
      }
      if (coupon.applies_to_cycle && coupon.applies_to_cycle !== "both" && coupon.applies_to_cycle !== cycleChoice) {
        return new Response(JSON.stringify({ error: `Cupom só vale para o ciclo ${coupon.applies_to_cycle === "yearly" ? "anual" : "mensal"}` }), { status: 400, headers: corsHeaders });
      }
      const { data: prevRedeem } = await admin
        .from("subscription_coupon_redemptions")
        .select("id").eq("coupon_id", coupon.id).eq("user_id", userId).maybeSingle();
      if (prevRedeem) {
        return new Response(JSON.stringify({ error: "Você já usou este cupom" }), { status: 400, headers: corsHeaders });
      }
      if (coupon.discount_type === "percent") {
        discountCents = Math.round(baseCents * (Number(coupon.discount_value) / 100));
      } else {
        discountCents = Math.round(Number(coupon.discount_value) * 100);
      }
      if (discountCents > baseCents) discountCents = baseCents;
      appliedCoupon = coupon;
    }

    const finalValueCents = baseCents - discountCents;
    const finalValue = finalValueCents / 100;

    // 4. Asaas customer (criar ou reusar)
    let { data: cust } = await admin
      .from("asaas_customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!cust) {
      const created = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: userEmail,
          cpfCnpj: cpfDigits,
          mobilePhone: phone ? onlyDigits(phone) : undefined,
          externalReference: userId,
        }),
      });
      const ins = await admin.from("asaas_customers").insert({
        user_id: userId,
        asaas_customer_id: created.id,
        cpf_cnpj: cpfDigits,
        name,
        email: userEmail,
        phone: phone || null,
      }).select().single();
      cust = ins.data;
    }

    // 5. Subscription Asaas — trial: nextDueDate = hoje + 7
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 7);
    const nextDueDateStr = nextDue.toISOString().slice(0, 10);

    const sub = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: cust!.asaas_customer_id,
        billingType: billing_type,
        value: finalValue,
        nextDueDate: nextDueDateStr,
        cycle: asaasCycle,
        description: `EVA OS — Plano ${plan.name} (${cycleChoice === "yearly" ? "Anual" : "Mensal"})`,
        externalReference: userId,
      }),
    });

    // 6. Buscar primeira cobrança pra pegar URL de pagamento
    let invoiceUrl: string | null = null;
    try {
      const payments = await asaasFetch(`/subscriptions/${sub.id}/payments`);
      invoiceUrl = payments?.data?.[0]?.invoiceUrl || null;
    } catch (e) {
      console.warn("Não foi possível obter invoice URL", e);
    }

    // 7. Persistir
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);

    const { data: subscription, error: subErr } = await admin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        asaas_subscription_id: sub.id,
        status: "trialing",
        billing_type,
        billing_cycle: cycleChoice,
        is_beta: false,
        discount_percent: 0,
        coupon_code: appliedCoupon?.code ?? null,
        discount_amount_cents: discountCents,
        trial_ends_at: trialEnds.toISOString(),
        next_due_date: nextDueDateStr,
        invoice_url: invoiceUrl,
      })
      .select()
      .single();

    if (subErr) {
      console.error("Erro ao salvar subscription", subErr);
      return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: corsHeaders });
    }

    if (appliedCoupon) {
      await admin.from("subscription_coupon_redemptions").insert({
        coupon_id: appliedCoupon.id,
        user_id: userId,
        subscription_id: subscription.id,
      });
      await admin.from("subscription_coupons")
        .update({ used_count: (appliedCoupon.used_count ?? 0) + 1 })
        .eq("id", appliedCoupon.id);
    }

    return new Response(
      JSON.stringify({
        subscription,
        invoice_url: invoiceUrl,
        billing_cycle: cycleChoice,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

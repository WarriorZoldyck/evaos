import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Autenticação por token (configurar no painel Asaas)
    const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const got = req.headers.get("asaas-access-token") || req.headers.get("Asaas-Access-Token");
    if (!expected || got !== expected) {
      console.warn("Webhook auth failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const event = await req.json();
    const eventId: string | undefined = event?.id;
    const eventType: string = event?.event || "UNKNOWN";
    const payment = event?.payment || {};

    // Extração flexível do subscriptionId
    let subscriptionId: string | undefined =
      (typeof payment?.subscription === "string" ? payment.subscription : payment?.subscription?.id) ||
      (typeof event?.subscription === "string" ? event.subscription : event?.subscription?.id) ||
      payment?.subscriptionId;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotência
    if (eventId) {
      const { data: dup } = await admin
        .from("asaas_webhook_events")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200, headers: corsHeaders });
      }
    }

    await admin.from("asaas_webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      asaas_payment_id: payment?.id || null,
      asaas_subscription_id: subscriptionId || null,
      payload: event,
    });

    // Localizar assinatura no Supabase
    let sub: any = null;

    if (subscriptionId) {
      const { data } = await admin
        .from("subscriptions")
        .select("*")
        .eq("asaas_subscription_id", subscriptionId)
        .maybeSingle();
      sub = data;
    }

    // Fallback: se não encontrou por subscriptionId direto, tenta localizar pelo cliente Asaas
    if (!sub && payment?.customer) {
      const { data: cust } = await admin
        .from("asaas_customers")
        .select("user_id")
        .eq("asaas_customer_id", payment.customer)
        .maybeSingle();

      if (cust?.user_id) {
        const { data: userSubs } = await admin
          .from("subscriptions")
          .select("*")
          .eq("user_id", cust.user_id)
          .in("status", ["active", "past_due", "trialing"])
          .order("updated_at", { ascending: false })
          .limit(1);

        sub = userSubs?.[0];
      }
    }

    if (!sub) {
      return new Response(JSON.stringify({ ok: true, ignored: "subscription not found" }), { status: 200, headers: corsHeaders });
    }

    const updates: Record<string, unknown> = {};

    // Verifica se é evento ou status de pagamento confirmado
    const isPaymentPaid =
      [
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_RECEIVED_IN_CASH",
        "PAYMENT_CREDITED",
        "PAYMENT_DUNNING_RECEIVED",
      ].includes(eventType) ||
      (eventType === "PAYMENT_UPDATED" &&
        ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"].includes(payment?.status));

    if (isPaymentPaid) {
      updates.status = "active";
      updates.last_payment_at = new Date().toISOString();
      updates.grace_until = null;

      // Se subscriptionId estava ausente na tabela, vincula agora
      if (subscriptionId && !sub.asaas_subscription_id) {
        updates.asaas_subscription_id = subscriptionId;
      }

      // Calcula período de cobertura real baseado no ciclo
      const cycle = sub.billing_cycle || "monthly";
      const baseDate = payment?.dueDate ? new Date(payment.dueDate) : new Date();
      const periodEnd = new Date(baseDate);
      if (cycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      updates.current_period_end = periodEnd.toISOString();

      if (payment?.invoiceUrl) updates.invoice_url = payment.invoiceUrl;
    } else {
      switch (eventType) {
        case "PAYMENT_OVERDUE": {
          // Proteção contra eventos de overdue retroativos caso já haja pagamento recente
          const isActuallyPaid = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment?.status);
          const hasRecentPayment =
            sub.last_payment_at &&
            Date.now() - new Date(sub.last_payment_at).getTime() < 30 * 24 * 60 * 60 * 1000;

          if (!isActuallyPaid && !hasRecentPayment) {
            const grace = new Date();
            grace.setDate(grace.getDate() + 5);
            updates.status = "past_due";
            updates.grace_until = grace.toISOString();
          }
          break;
        }
        case "PAYMENT_DELETED":
        case "PAYMENT_REFUNDED":
        case "PAYMENT_CHARGEBACK_REQUESTED":
        case "PAYMENT_CHARGEBACK_DISPUTE": {
          updates.status = "canceled";
          updates.canceled_at = new Date().toISOString();
          break;
        }
        case "SUBSCRIPTION_DELETED":
        case "SUBSCRIPTION_INACTIVATED": {
          updates.status = "canceled";
          updates.canceled_at = new Date().toISOString();
          break;
        }
        case "PAYMENT_CREATED":
        case "PAYMENT_UPDATED": {
          if (payment?.invoiceUrl) updates.invoice_url = payment.invoiceUrl;
          if (payment?.dueDate) updates.next_due_date = payment.dueDate;
          break;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await admin.from("subscriptions").update(updates).eq("id", sub.id);
    }

    return new Response(JSON.stringify({ ok: true, updated: Object.keys(updates) }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("Webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

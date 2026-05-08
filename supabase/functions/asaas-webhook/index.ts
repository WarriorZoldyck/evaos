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
    const subscriptionId: string | undefined = payment?.subscription;

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

    if (!subscriptionId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no subscription" }), { status: 200, headers: corsHeaders });
    }

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ ok: true, ignored: "subscription not found" }), { status: 200, headers: corsHeaders });
    }

    const updates: Record<string, unknown> = {};

    switch (eventType) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
      case "PAYMENT_RECEIVED_IN_CASH": {
        updates.status = "active";
        updates.last_payment_at = new Date().toISOString();
        updates.grace_until = null;
        if (payment?.dueDate) updates.current_period_end = new Date(payment.dueDate).toISOString();
        break;
      }
      case "PAYMENT_OVERDUE": {
        const grace = new Date();
        grace.setDate(grace.getDate() + 3);
        updates.status = "past_due";
        updates.grace_until = grace.toISOString();
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

    if (Object.keys(updates).length > 0) {
      await admin.from("subscriptions").update(updates).eq("id", sub.id);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("Webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

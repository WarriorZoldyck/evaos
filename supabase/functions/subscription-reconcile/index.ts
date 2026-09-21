import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const GRACE_DAYS = 5;

async function asaasFetch(path: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "User-Agent": "EVA OS", access_token: apiKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`);
  return data;
}

const PAID = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: subs, error } = await admin
      .from("subscriptions")
      .select("id, user_id, status, billing_cycle, asaas_subscription_id, trial_ends_at, grace_until, current_period_end, next_due_date, last_payment_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const report: any[] = [];

    for (const sub of subs || []) {
      try {
        // Sem vínculo no Asaas: cortesia/beta/manual — não altera.
        if (!sub.asaas_subscription_id) {
          report.push({ id: sub.id, user_id: sub.user_id, skipped: "sem_asaas" });
          continue;
        }

        const asaasSub = await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}`);
        const paymentsRes = await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}/payments?limit=100`);
        const payments: any[] = paymentsRes?.data || [];

        const paid = payments
          .filter((p) => PAID.includes(p.status))
          .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
        const latestPaid = paid[0];
        const overdue = payments
          .filter((p) => p.status === "OVERDUE")
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const updates: Record<string, unknown> = {};

        // Cobertura real paga
        let periodEnd: Date | null = null;
        if (latestPaid) {
          const cycle = sub.billing_cycle || (asaasSub?.cycle === "YEARLY" ? "yearly" : "monthly");
          periodEnd = new Date(`${latestPaid.dueDate}T23:59:59Z`);
          if (cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          else periodEnd.setMonth(periodEnd.getMonth() + 1);

          const paidAt = latestPaid.confirmedDate || latestPaid.paymentDate || latestPaid.clientPaymentDate || latestPaid.dueDate;
          updates.last_payment_at = new Date(`${String(paidAt).slice(0, 10)}T12:00:00Z`).toISOString();
          updates.current_period_end = periodEnd.toISOString();
        }

        if (asaasSub?.nextDueDate) updates.next_due_date = asaasSub.nextDueDate;
        const invoice = overdue[0]?.invoiceUrl || payments[0]?.invoiceUrl;
        if (invoice) updates.invoice_url = invoice;

        const covered = !!periodEnd && periodEnd.getTime() > Date.now();
        const cancelled = ["INACTIVE", "DELETED", "EXPIRED"].includes(String(asaasSub?.status));

        if (cancelled && !covered) {
          updates.status = "canceled";
          updates.canceled_at = sub.status === "canceled" ? undefined : new Date().toISOString();
          updates.grace_until = null;
        } else if (covered && overdue.length === 0) {
          updates.status = "active";
          updates.grace_until = null;
        } else if (overdue.length > 0) {
          const firstOverdue = new Date(`${overdue[0].dueDate}T23:59:59Z`);
          const graceEnd = new Date(firstOverdue.getTime() + GRACE_DAYS * 86400000);
          if (graceEnd.getTime() > Date.now()) {
            updates.status = "past_due";
            updates.grace_until = graceEnd.toISOString();
          } else {
            updates.status = "expired";
            updates.grace_until = graceEnd.toISOString();
          }
        } else if (covered) {
          updates.status = "active";
          updates.grace_until = null;
        } else if (sub.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now()) {
          // mantém trial vigente
        } else {
          updates.status = "expired";
        }

        Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
        updates.updated_at = new Date().toISOString();
        await admin.from("subscriptions").update(updates).eq("id", sub.id);

        report.push({
          id: sub.id,
          user_id: sub.user_id,
          before: sub.status,
          after: updates.status ?? sub.status,
          asaas_status: asaasSub?.status,
          overdue: overdue.length,
          overdue_since: overdue[0]?.dueDate ?? null,
          paid_through: periodEnd?.toISOString().slice(0, 10) ?? null,
          invoice_url: invoice ?? null,
        });
      } catch (e) {
        report.push({ id: sub.id, user_id: sub.user_id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, total: report.length, report }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reconcile error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

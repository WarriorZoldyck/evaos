import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada no ambiente");
  }
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Busca a assinatura do usuário no Supabase
    // Prioriza ativas ou past_due mais recentes
    const { data: subs, error: subErr } = await admin
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: corsHeaders });
    }

    const sub = (subs || []).find((s: any) => ["active", "past_due", "trialing"].includes(s.status)) || subs?.[0];

    if (!sub) {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura encontrada para este usuário" }), { status: 404, headers: corsHeaders });
    }

    if (!sub.asaas_subscription_id) {
      // Se não tem ID no Asaas (ex: beta manual ou cortesia), mantém status atual
      return new Response(JSON.stringify({ subscription: sub, synced: false, reason: "No Asaas subscription ID" }), { status: 200, headers: corsHeaders });
    }

    // 2. Consulta a assinatura no Asaas
    const asaasSub = await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}`);

    // 3. Consulta as cobranças da assinatura no Asaas
    const paymentsRes = await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}/payments?limit=10`);
    const payments: any[] = paymentsRes?.data || [];

    // Pagamento confirmado/recebido mais recente
    const paidPayments = payments.filter((p: any) =>
      ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"].includes(p.status)
    );
    const latestPaid = paidPayments[0];

    // Cobranças vencidas pendentes
    const overduePayments = payments.filter((p: any) => p.status === "OVERDUE");

    const updates: Record<string, unknown> = {};

    if (asaasSub.status === "ACTIVE") {
      // Se a assinatura está ACTIVE no Asaas e tem algum pagamento recebido ou não tem pagamentos atrasados
      if (latestPaid || overduePayments.length === 0) {
        updates.status = "active";
        updates.grace_until = null;

        if (latestPaid) {
          const paidDate = latestPaid.confirmedDate || latestPaid.paymentDate || latestPaid.clientPaymentDate || new Date().toISOString();
          updates.last_payment_at = new Date(paidDate).toISOString();

          // Calcula período de cobertura baseado no ciclo
          const cycle = sub.billing_cycle || (asaasSub.cycle === "YEARLY" ? "yearly" : "monthly");
          const baseDate = latestPaid.dueDate ? new Date(latestPaid.dueDate) : new Date(paidDate);
          const periodEnd = new Date(baseDate);
          if (cycle === "yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }
          updates.current_period_end = periodEnd.toISOString();
        }

        if (asaasSub.nextDueDate) {
          updates.next_due_date = asaasSub.nextDueDate;
        }

        const latestInvoice = payments[0]?.invoiceUrl || latestPaid?.invoiceUrl;
        if (latestInvoice) {
          updates.invoice_url = latestInvoice;
        }
      } else if (overduePayments.length > 0) {
        // Realmente há fatura em atraso sem pagamento
        updates.status = "past_due";
        if (!sub.grace_until || new Date(sub.grace_until).getTime() < Date.now()) {
          const grace = new Date();
          grace.setDate(grace.getDate() + 3);
          updates.grace_until = grace.toISOString();
        }
        if (overduePayments[0]?.invoiceUrl) {
          updates.invoice_url = overduePayments[0].invoiceUrl;
        }
      }
    } else if (["INACTIVE", "DELETED"].includes(asaasSub.status)) {
      updates.status = "canceled";
      updates.canceled_at = updates.canceled_at || new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { data: updatedSub, error: updateErr } = await admin
        .from("subscriptions")
        .update(updates)
        .eq("id", sub.id)
        .select("*, plan:subscription_plans(*)")
        .single();

      if (updateErr) {
        throw updateErr;
      }

      return new Response(
        JSON.stringify({ ok: true, subscription: updatedSub, synced: true, message: "Assinatura sincronizada com o Asaas." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, subscription: sub, synced: true, message: "Status já atualizado." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Erro ao sincronizar assinatura", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

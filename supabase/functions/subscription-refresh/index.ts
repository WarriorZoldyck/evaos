import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasFetch(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "EVA OS",
      access_token: Deno.env.get("ASAAS_API_KEY")!,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.asaas_subscription_id) {
      return new Response(JSON.stringify({ ok: true, released: false, reason: "no_asaas_subscription" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payments = await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}/payments?limit=20`);
    const list: Array<Record<string, unknown>> = payments?.data || [];

    const paid = list.filter((p) =>
      ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(String(p.status)),
    );
    const overdue = list.filter((p) => String(p.status) === "OVERDUE");
    const pending = list
      .filter((p) => ["PENDING", "AWAITING_RISK_ANALYSIS"].includes(String(p.status)))
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

    const updates: Record<string, unknown> = {};
    let released = false;

    if (overdue.length === 0 && paid.length > 0) {
      const latestPaid = paid.sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)))[0];
      updates.status = "active";
      updates.grace_until = null;
      updates.last_payment_at = new Date().toISOString();
      if (latestPaid?.dueDate) updates.current_period_end = new Date(String(latestPaid.dueDate)).toISOString();
      released = true;
    }

    const nextPending = pending[0] || overdue[0];
    if (nextPending?.dueDate) updates.next_due_date = String(nextPending.dueDate);
    if (nextPending?.invoiceUrl) updates.invoice_url = String(nextPending.invoiceUrl);

    if (Object.keys(updates).length > 0) {
      await admin.from("subscriptions").update(updates).eq("id", sub.id);
    }

    return new Response(JSON.stringify({ ok: true, released }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("subscription-refresh error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

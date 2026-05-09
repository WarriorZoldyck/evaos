import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptApiKey } from "../_shared/asaas-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const SYNC_DAYS = 90;
const MATCH_WINDOW_DAYS = 3;

async function asaasGet(path: string, apiKey: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: apiKey, "User-Agent": "EVA OS" },
  });
  if (!res.ok) throw new Error(`Asaas ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchAllPaged(path: string, apiKey: string, limit = 100): Promise<any[]> {
  const out: any[] = [];
  let offset = 0;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await asaasGet(`${path}${sep}limit=${limit}&offset=${offset}`, apiKey);
    const items: any[] = data?.data || [];
    out.push(...items);
    if (!data?.hasMore || items.length === 0) break;
    offset += items.length;
    if (offset > 5000) break; // safety
  }
  return out;
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

async function syncIntegration(admin: any, integration: any) {
  const apiKey = await decryptApiKey(integration.api_key_encrypted, integration.api_key_iv);

  await admin.from("asaas_integrations").update({ sync_status: "syncing" }).eq("id", integration.id);

  const since = new Date();
  since.setDate(since.getDate() - SYNC_DAYS);
  const sinceStr = ymd(since);

  // 1. Financial transactions (extrato)
  const fts = await fetchAllPaged(
    `/financialTransactions?startDate=${sinceStr}`,
    apiKey,
  );

  // 2. Payments received
  const payments = await fetchAllPaged(
    `/payments?status=RECEIVED&dateCreated[ge]=${sinceStr}`,
    apiKey,
  );
  const confirmed = await fetchAllPaged(
    `/payments?status=CONFIRMED&dateCreated[ge]=${sinceStr}`,
    apiKey,
  );

  type Item = {
    asaas_id: string;
    source_type: string;
    amount: number;
    date: string;
    description: string;
    asaas_status: string | null;
    payload: any;
  };

  const items: Item[] = [];
  for (const t of fts) {
    items.push({
      asaas_id: String(t.id),
      source_type: "financial_transaction",
      amount: Math.abs(Number(t.value || 0)),
      date: (t.date || t.createdAt || "").slice(0, 10),
      description: t.description || t.type || "Movimento Asaas",
      asaas_status: t.type || null,
      payload: t,
    });
  }
  for (const p of [...payments, ...confirmed]) {
    items.push({
      asaas_id: String(p.id),
      source_type: "payment",
      amount: Math.abs(Number(p.value || p.netValue || 0)),
      date: (p.confirmedDate || p.paymentDate || p.dueDate || "").slice(0, 10),
      description: p.description || `Cobrança ${p.billingType || ""}`.trim(),
      asaas_status: p.status,
      payload: p,
    });
  }

  let inserted = 0;
  for (const it of items) {
    if (!it.date) continue;
    const { error } = await admin
      .from("asaas_sync_items")
      .upsert(
        {
          integration_id: integration.id,
          user_id: integration.user_id,
          asaas_id: it.asaas_id,
          source_type: it.source_type,
          amount: it.amount,
          date: it.date,
          description: it.description?.slice(0, 500) || "",
          asaas_status: it.asaas_status,
          payload: it.payload,
        },
        { onConflict: "integration_id,asaas_id,source_type", ignoreDuplicates: false },
      );
    if (!error) inserted++;
  }

  // Matching
  const { data: pendings } = await admin
    .from("asaas_sync_items")
    .select("*")
    .eq("integration_id", integration.id)
    .eq("match_status", "pending");

  let matched = 0;
  for (const item of (pendings || [])) {
    const dateFrom = new Date(item.date);
    dateFrom.setDate(dateFrom.getDate() - MATCH_WINDOW_DAYS);
    const dateTo = new Date(item.date);
    dateTo.setDate(dateTo.getDate() + MATCH_WINDOW_DAYS);

    const { data: candidates } = await admin
      .from("transactions")
      .select("id, description, amount, payment_date, type")
      .eq("user_id", integration.user_id)
      .eq("bank_account_id", integration.bank_account_id)
      .eq("amount", item.amount)
      .gte("payment_date", ymd(dateFrom))
      .lte("payment_date", ymd(dateTo))
      .limit(5);

    if (candidates && candidates.length === 1) {
      await admin
        .from("asaas_sync_items")
        .update({
          match_status: "matched",
          matched_transaction_id: candidates[0].id,
        })
        .eq("id", item.id);
      await admin
        .from("transactions")
        .update({ is_reconciled: true })
        .eq("id", candidates[0].id);
      matched++;
    } else if (candidates && candidates.length > 1) {
      await admin
        .from("asaas_sync_items")
        .update({
          payload: { ...item.payload, suggestions: candidates.map((c: any) => c.id) },
        })
        .eq("id", item.id);
    }
  }

  // Refresh balance
  let currentBalance: number | null = null;
  try {
    const bal = await asaasGet("/finance/balance", apiKey);
    currentBalance = Number(bal?.balance ?? 0);
  } catch (_) {}

  await admin
    .from("asaas_integrations")
    .update({
      sync_status: "idle",
      last_sync_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", integration.id);

  return { items_processed: items.length, items_inserted: inserted, matched, current_balance: currentBalance };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cron mode: ?mode=cron with secret header
    const url = new URL(req.url);
    const isCron = url.searchParams.get("mode") === "cron";

    if (isCron) {
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== Deno.env.get("ASAAS_WEBHOOK_TOKEN")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const { data: integrations } = await admin.from("asaas_integrations").select("*");
      const results: any[] = [];
      for (const integ of integrations || []) {
        try {
          const r = await syncIntegration(admin, integ);
          results.push({ id: integ.id, ...r });
        } catch (e) {
          await admin
            .from("asaas_integrations")
            .update({ sync_status: "error", last_error: (e as Error).message })
            .eq("id", integ.id);
          results.push({ id: integ.id, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: corsHeaders });
    }

    // User-triggered
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

    const body = await req.json().catch(() => ({}));
    const integrationId = body?.integration_id as string | undefined;

    const query = admin.from("asaas_integrations").select("*").eq("user_id", userId);
    const { data: integrations } = integrationId
      ? await query.eq("id", integrationId)
      : await query;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ error: "Integração não encontrada" }), { status: 404, headers: corsHeaders });
    }

    const results: any[] = [];
    for (const integ of integrations) {
      try {
        const r = await syncIntegration(admin, integ);
        results.push({ id: integ.id, ...r });
      } catch (e) {
        await admin
          .from("asaas_integrations")
          .update({ sync_status: "error", last_error: (e as Error).message })
          .eq("id", integ.id);
        results.push({ id: integ.id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("sync error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

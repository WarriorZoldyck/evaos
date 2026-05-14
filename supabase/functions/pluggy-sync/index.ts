import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPluggyApiKey, pluggyGet } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYNC_DAYS = 90;
const MATCH_WINDOW_DAYS = 3;

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

async function fetchAllTransactions(accountId: string, fromYmd: string, apiKey: string) {
  const out: any[] = [];
  let page = 1;
  while (true) {
    const data = await pluggyGet(
      `/transactions?accountId=${accountId}&from=${fromYmd}&pageSize=200&page=${page}`,
      apiKey,
    );
    const items: any[] = data?.results || [];
    out.push(...items);
    const totalPages = data?.totalPages ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
    if (out.length > 5000) break; // safety
  }
  return out;
}

async function syncIntegration(admin: any, integration: any, apiKey: string) {
  await admin.from("pluggy_integrations").update({ sync_status: "syncing" }).eq("id", integration.id);

  const since = new Date();
  since.setDate(since.getDate() - SYNC_DAYS);
  const sinceStr = ymd(since);

  const txs = await fetchAllTransactions(integration.pluggy_account_id, sinceStr, apiKey);

  let inserted = 0;
  for (const t of txs) {
    const date = (t.date || "").slice(0, 10);
    if (!date) continue;
    const amount = Math.abs(Number(t.amount || 0));
    const isCredit = Number(t.amount) > 0;
    const description = (t.description || t.descriptionRaw || "Movimento Pluggy").slice(0, 500);
    const { error } = await admin
      .from("asaas_sync_items")
      .upsert(
        {
          integration_id: integration.id,
          user_id: integration.user_id,
          asaas_id: String(t.id),
          source_type: isCredit ? "pluggy_credit" : "pluggy_debit",
          amount,
          date,
          description,
          asaas_status: t.status || null,
          payload: t,
          provider: "pluggy",
        },
        { onConflict: "integration_id,asaas_id,source_type", ignoreDuplicates: false },
      );
    if (!error) inserted++;
  }

  // Match against transactions
  const { data: pendings } = await admin
    .from("asaas_sync_items")
    .select("*")
    .eq("integration_id", integration.id)
    .eq("match_status", "pending")
    .eq("provider", "pluggy");

  let matched = 0;
  for (const item of (pendings || [])) {
    const dateFrom = new Date(item.date);
    dateFrom.setDate(dateFrom.getDate() - MATCH_WINDOW_DAYS);
    const dateTo = new Date(item.date);
    dateTo.setDate(dateTo.getDate() + MATCH_WINDOW_DAYS);

    const { data: candidates } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", integration.user_id)
      .eq("bank_account_id", integration.bank_account_id)
      .eq("amount", item.amount)
      .gte("payment_date", ymd(dateFrom))
      .lte("payment_date", ymd(dateTo))
      .limit(5);

    if (candidates && candidates.length === 1) {
      await admin.from("asaas_sync_items").update({
        match_status: "matched",
        matched_transaction_id: candidates[0].id,
      }).eq("id", item.id);
      await admin.from("transactions").update({ is_reconciled: true }).eq("id", candidates[0].id);
      matched++;
    } else if (candidates && candidates.length > 1) {
      await admin.from("asaas_sync_items").update({
        payload: { ...item.payload, suggestions: candidates.map((c: any) => c.id) },
      }).eq("id", item.id);
    }
  }

  // Refresh balance + item status
  let currentBalance: number | null = null;
  let itemStatus: string | null = null;
  try {
    const account = await pluggyGet(`/accounts/${integration.pluggy_account_id}`, apiKey);
    currentBalance = Number(account?.balance ?? 0);
    const item = await pluggyGet(`/items/${integration.pluggy_item_id}`, apiKey);
    itemStatus = item?.status || null;
  } catch (_) { /* ignore */ }

  await admin.from("pluggy_integrations").update({
    sync_status: "idle",
    last_sync_at: new Date().toISOString(),
    last_error: null,
    item_status: itemStatus,
  }).eq("id", integration.id);

  return { items_processed: txs.length, items_inserted: inserted, matched, current_balance: currentBalance };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const isCron = url.searchParams.get("mode") === "cron";

    if (isCron) {
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== Deno.env.get("ASAAS_WEBHOOK_TOKEN")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const apiKey = await getPluggyApiKey();
      const { data: integrations } = await admin.from("pluggy_integrations").select("*");
      const results: any[] = [];
      for (const integ of integrations || []) {
        try {
          const r = await syncIntegration(admin, integ, apiKey);
          results.push({ id: integ.id, ...r });
        } catch (e) {
          await admin.from("pluggy_integrations").update({
            sync_status: "error",
            last_error: (e as Error).message,
          }).eq("id", integ.id);
          results.push({ id: integ.id, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: corsHeaders });
    }

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

    const query = admin.from("pluggy_integrations").select("*").eq("user_id", userId);
    const { data: integrations } = integrationId
      ? await query.eq("id", integrationId)
      : await query;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ error: "Integração não encontrada" }), { status: 404, headers: corsHeaders });
    }

    const apiKey = await getPluggyApiKey();
    const results: any[] = [];
    for (const integ of integrations) {
      try {
        const r = await syncIntegration(admin, integ, apiKey);
        results.push({ id: integ.id, ...r });
      } catch (e) {
        await admin.from("pluggy_integrations").update({
          sync_status: "error",
          last_error: (e as Error).message,
        }).eq("id", integ.id);
        results.push({ id: integ.id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("pluggy-sync error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

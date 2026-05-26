import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public endpoint — no JWT. Pluggy sends item events here.
// We don't fully trust the body; we look up the item in our DB and trigger a sync if known.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, ignored: "non-POST" }), { status: 200, headers: corsHeaders });
  }

  // Shared-secret auth (fail-closed). Configure Pluggy to send header `x-pluggy-webhook-secret`
  // or query param `?secret=...`. Falls back to ASAAS_WEBHOOK_TOKEN for backwards compatibility.
  const expectedSecret = Deno.env.get("PLUGGY_WEBHOOK_SECRET") || Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const headerSecret = req.headers.get("x-pluggy-webhook-secret") || req.headers.get("x-webhook-secret");
  let querySecret: string | null = null;
  try { querySecret = new URL(req.url).searchParams.get("secret"); } catch (_) {}
  if (!expectedSecret || (headerSecret !== expectedSecret && querySecret !== expectedSecret)) {
    console.warn("pluggy-webhook: rejected unauthenticated request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const event = await req.json().catch(() => ({}));
    const eventType: string = event?.event || "unknown";
    const itemId: string | undefined = event?.itemId || event?.data?.itemId;

    console.log("pluggy-webhook:", eventType, itemId);

    if (!itemId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no itemId" }), { status: 200, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integ } = await admin
      .from("pluggy_integrations")
      .select("id, user_id")
      .eq("pluggy_item_id", itemId)
      .maybeSingle();

    if (!integ) {
      return new Response(JSON.stringify({ ok: true, ignored: "unknown item" }), { status: 200, headers: corsHeaders });
    }

    // Mark item status if it's an error/login event
    if (eventType.startsWith("item/")) {
      const status = eventType === "item/error" ? "error" : eventType === "item/login_succeeded" ? "ok" : null;
      if (status) {
        await admin.from("pluggy_integrations").update({
          item_status: status,
          last_error: status === "error" ? (event?.error?.message || "Pluggy item error") : null,
        }).eq("id", integ.id);
      }
    }

    // Trigger a sync only when there's likely new data
    if (eventType === "item/updated" || eventType === "transactions/updated" || eventType === "item/login_succeeded") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const cronSecret = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
      // Fire-and-forget call to pluggy-sync (cron mode is global; use per-integration via service role POST instead)
      fetch(`${supabaseUrl}/functions/v1/pluggy-sync?mode=cron`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({}),
      }).catch((e) => console.warn("trigger sync failed", e));
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("pluggy-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

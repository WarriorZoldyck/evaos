import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBudgetInsight, shouldSendBudgetFollowUp } from "../_shared/budget-insight.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Serviço indisponível" }, 503);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autorizado" }, 401);
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);
    const body = await req.json().catch(() => null);
    if (typeof body?.pending_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.pending_id)) {
      return json({ error: "Aprovação inválida" }, 400);
    }
    // Read both exact records through the caller's RLS, never from supplied financial data.
    const { data: pending, error: pendingError } = await client.from("ai_pending_transactions")
      .select("id,user_id,status,approved_transaction_id").eq("id", body.pending_id).maybeSingle();
    if (pendingError || !pending) return json({ error: "Aprovação não encontrada" }, 404);
    if (!shouldSendBudgetFollowUp(pending.status, pending.approved_transaction_id)) return json({ skipped: "not_approved" });
    if (user.id !== pending.user_id) {
      const { data: writer, error } = await client.rpc("is_hub_member_writer", { _member_uid: user.id, _owner_uid: pending.user_id });
      if (error || !writer) return json({ error: "Sem permissão" }, 403);
    }
    const { data: tx, error: txError } = await client.from("transactions")
      .select("id,user_id,company_id,category,subcategory,subcategory2,type,competence_date")
      .eq("id", pending.approved_transaction_id).eq("user_id", pending.user_id).maybeSingle();
    if (txError || !tx) return json({ error: "Lançamento não encontrado" }, 404);
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const monthKey = `${month.find(p => p.type === "year")?.value}-${month.find(p => p.type === "month")?.value}`;
    if (!tx.competence_date.startsWith(monthKey)) return json({ skipped: "outside_current_month" });
    const admin = createClient(url, service);
    const { data: profile, error: profileError } = await admin.from("profiles").select("whatsapp_number").eq("id", tx.user_id).maybeSingle();
    if (profileError) throw profileError;
    const digits = String(profile?.whatsapp_number || "").replace(/\D/g, "");
    if (digits.length < 10) return json({ skipped: "no_whatsapp" });
    // Always send to the record owner; members cannot redirect another tenant's financial information.
    const insight = await buildBudgetInsight(admin, tx.user_id, tx.company_id, [tx.category, tx.subcategory, tx.subcategory2], tx.type);
    if (!insight) return json({ skipped: "no_budget" });
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const instance = Deno.env.get("EVOLUTION_INSTANCE");
    if (!evoUrl || !evoKey || !instance) return json({ error: "WhatsApp indisponível" }, 503);
    const { error: claimError } = await admin.from("budget_approval_notifications").insert({
      pending_id: pending.id, user_id: tx.user_id, transaction_id: tx.id,
    });
    if (claimError?.code === "23505") return json({ skipped: "already_attempted" });
    if (claimError) throw claimError;
    // Claim first: uncertain provider results must not cause duplicate financial messages on retries.
    try {
      const response = await fetch(`${evoUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`, {
        method: "POST", headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: digits.startsWith("55") ? digits : `55${digits}`, text: `✅ Lançamento aprovado e registrado.\n\n${insight}` }),
      });
      if (!response.ok) {
        const details = await response.text();
        console.error("Budget WhatsApp provider failed", response.status, details);
        await admin.from("budget_approval_notifications").update({ status: "failed" }).eq("pending_id", pending.id);
        return json({ error: "WhatsApp recusou o aviso", status: response.status, details }, response.status);
      }
      const { error } = await admin.from("budget_approval_notifications").update({ status: "accepted" }).eq("pending_id", pending.id);
      if (error) throw error;
      return json({ accepted: true });
    } catch (error) {
      await admin.from("budget_approval_notifications").update({ status: "failed" }).eq("pending_id", pending.id);
      throw error;
    }
  } catch (error) {
    console.error("Budget approval notification failed", error);
    return json({ error: "Não foi possível enviar o aviso" }, 500);
  }
});
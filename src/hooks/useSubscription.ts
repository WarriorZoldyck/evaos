import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_type: string;
  billing_cycle: string;
  is_beta: boolean;
  discount_percent: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  canceled_at: string | null;
  next_due_date: string | null;
  invoice_url: string | null;
  last_payment_at: string | null;
  asaas_subscription_id: string | null;
  plan?: {
    id: string;
    slug: string;
    name: string;
    price_cents: number;
    max_users: number;
    features: string[];
  };
}

const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const hasAutoSynced = useRef(false);

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const rows = (data || []) as SubscriptionRow[];
      if (!rows.length) return null;

      const now = Date.now();

      // 1) Ativa com período pago vigente (ou vitalícia/cortesia sem vencimento)
      const active = rows.find(
        (r) => r.status === "active" && (!r.current_period_end || ts(r.current_period_end) > now),
      );
      if (active) return active;

      // 2) Teste vigente
      const trialing = rows.find((r) => r.status === "trialing" && ts(r.trial_ends_at) > now);
      if (trialing) return trialing;

      // 3) Em tolerância
      const inGrace = rows.find((r) => r.status === "past_due" && ts(r.grace_until) > now);
      if (inGrace) return inGrace;

      return rows[0];
    },
  });

  const sub = query.data;
  const now = Date.now();

  // Regra única e estrita: o acesso vem do status + janelas de tempo.
  const isInTrial = !!sub && sub.status === "trialing" && ts(sub.trial_ends_at) > now;
  const isActive =
    !!sub && sub.status === "active" && (!sub.current_period_end || ts(sub.current_period_end) > now);
  const isPastDue = !!sub && sub.status === "past_due";
  const isInGrace = isPastDue && ts(sub!.grace_until) > now;

  const hasAccess = Boolean(isInTrial || isActive || isInGrace);
  const isBlocked = !!sub && !hasAccess;
  const noSubscription = !sub;

  const daysToBlock =
    isInGrace && sub?.grace_until
      ? Math.max(0, Math.ceil((ts(sub.grace_until) - now) / 86400000))
      : 0;

  // Consulta o Asaas e reativa automaticamente quem já pagou
  const syncSubscription = async () => {
    if (!user?.id || !sub?.asaas_subscription_id || isSyncing) return null;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-sync-subscription", { body: {} });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["subscription", user.id] });
      return data;
    } catch (err) {
      console.warn("Falha ao sincronizar com Asaas:", err);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  // Sem acesso mas com assinatura no Asaas: confere uma vez em background
  useEffect(() => {
    if (!hasAutoSynced.current && sub?.asaas_subscription_id && !hasAccess && !query.isLoading) {
      hasAutoSynced.current = true;
      syncSubscription();
    }
  }, [sub?.asaas_subscription_id, hasAccess, query.isLoading]);

  return {
    ...query,
    subscription: sub,
    isInTrial,
    isActive,
    isPastDue,
    isInGrace,
    daysToBlock,
    hasAccess,
    isBlocked,
    noSubscription,
    isSyncing,
    syncSubscription,
  };
}

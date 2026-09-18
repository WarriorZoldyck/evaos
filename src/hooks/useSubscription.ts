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

      // Prioriza assinatura ativa
      const active = rows.find((r) => r.status === "active");
      if (active) return active;

      // Em teste vigente
      const trialing = rows.find(
        (r) => r.status === "trialing" && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > Date.now(),
      );
      if (trialing) return trialing;

      // Em atraso / carência
      const pastDue = rows.find((r) => r.status === "past_due");
      if (pastDue) return pastDue;

      return rows[0];
    },
  });

  const sub = query.data;
  const now = Date.now();

  // Verificação de consistência de pagamentos
  const hasRecentPayment = Boolean(
    sub?.last_payment_at && now - new Date(sub.last_payment_at).getTime() < 35 * 24 * 60 * 60 * 1000,
  );
  const hasFutureDueDate = Boolean(
    sub?.next_due_date && new Date(sub.next_due_date).getTime() >= new Date().setHours(0, 0, 0, 0),
  );
  const hasValidPeriod = Boolean(
    sub?.current_period_end && new Date(sub.current_period_end).getTime() > now,
  );

  // Se o usuário tem pagamento recente ou data futura, a assinatura é considerada ativa
  const isActuallyActive =
    sub?.status === "active" ||
    (sub?.status === "past_due" && (hasRecentPayment || hasFutureDueDate || hasValidPeriod));

  const isInTrial =
    sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now;
  const isActive = isActuallyActive;
  const isInGrace =
    !isActuallyActive && sub?.status === "past_due" && sub.grace_until && new Date(sub.grace_until).getTime() > now;
  const hasAccess = Boolean(isInTrial || isActive || isInGrace);
  const isBlocked = !!sub && !hasAccess;
  const noSubscription = !sub;

  // Função manual para consultar e sincronizar com o Asaas
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

  // Se a assinatura está como past_due no banco, dispara sync automático em background uma vez
  useEffect(() => {
    if (sub?.status === "past_due" && sub.asaas_subscription_id && !hasAutoSynced.current) {
      hasAutoSynced.current = true;
      syncSubscription();
    }
  }, [sub?.status, sub?.asaas_subscription_id]);

  return {
    ...query,
    subscription: sub,
    isInTrial: !!isInTrial,
    isActive,
    isInGrace: !!isInGrace,
    hasAccess,
    isBlocked,
    noSubscription,
    isSyncing,
    syncSubscription,
  };
}

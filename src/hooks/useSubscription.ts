import { useQuery } from "@tanstack/react-query";
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

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionRow | null;
    },
  });

export const GRACE_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionRow | null;
    },
  });

  const sub = query.data;
  const now = Date.now();

  const trialValid =
    sub?.status === "trialing" && !!sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now;

  // Vencimento em aberto mesmo com status "active" (webhook pode não ter chegado)
  const dueTime = sub?.next_due_date ? new Date(`${sub.next_due_date}T23:59:59`).getTime() : null;
  const periodEndTime = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const isOverdueActive =
    sub?.status === "active" &&
    !!dueTime &&
    dueTime < now &&
    (periodEndTime === null || periodEndTime < now);

  const graceTime = sub?.grace_until ? new Date(sub.grace_until).getTime() : null;

  // Momento em que o acesso será bloqueado, quando houver pendência
  let blockAt: Date | null = null;
  if (sub?.status === "past_due") {
    blockAt = graceTime ? new Date(graceTime) : new Date(now);
  } else if (isOverdueActive && dueTime) {
    blockAt = new Date(dueTime + GRACE_DAYS * DAY_MS);
  }

  const isPastDue = sub?.status === "past_due" || isOverdueActive;
  const isInGrace = isPastDue && !!blockAt && blockAt.getTime() > now;
  const isActive = sub?.status === "active" && !isOverdueActive;
  const isInTrial = trialValid;

  const hasAccess = Boolean(isInTrial || isActive || isInGrace);
  const isBlocked = !!sub && !hasAccess;
  const noSubscription = !sub;

  const daysToBlock =
    blockAt && blockAt.getTime() > now
      ? Math.max(0, Math.ceil((blockAt.getTime() - now) / DAY_MS))
      : 0;

  return {
    ...query,
    subscription: sub,
    isInTrial,
    isActive,
    isPastDue,
    isInGrace,
    blockAt,
    daysToBlock,
    hasAccess,
    isBlocked,
    noSubscription,
  };
}

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

  const sub = query.data;
  const now = Date.now();

  const isInTrial =
    sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now;
  const isActive = sub?.status === "active";
  const isInGrace =
    sub?.status === "past_due" && sub.grace_until && new Date(sub.grace_until).getTime() > now;
  const hasAccess = Boolean(isInTrial || isActive || isInGrace);
  const isBlocked = !!sub && !hasAccess;
  const noSubscription = !sub;

  return {
    ...query,
    subscription: sub,
    isInTrial: !!isInTrial,
    isActive,
    isInGrace: !!isInGrace,
    hasAccess,
    isBlocked,
    noSubscription,
  };
}

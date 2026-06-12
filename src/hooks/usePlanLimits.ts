import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

export interface PlanLimits {
  max_accounts: number | null;
  max_hub_members: number;
  monthly_ai_messages: number | null;
  extra_user_price_cents: number;
}

interface PlanLimitsState {
  isLoading: boolean;
  effectivePlanSlug: string;
  isTrialFullAccess: boolean;
  limits: PlanLimits;
  usage: {
    accounts: number;
    bankAccounts: number;
    creditCards: number;
    wallets: number;
    terminals: number;
    hubMembers: number;
    aiMessagesThisMonth: number;
  };
  canCreateAccount: (kind?: AccountKind) => { ok: boolean; reason?: string };
  canCreateHubMember: () => { ok: boolean; reason?: string };
  canUseAI: () => { ok: boolean; reason?: string; remaining: number | null };
  hubAllowed: boolean;
  refetch: () => void | Promise<unknown>;
}

export type AccountKind = "bank" | "card" | "wallet" | "terminal";

interface SubscriptionPlanLimits extends PlanLimits {
  slug: string;
}

interface UsageCounterRow {
  messages_used: number | null;
}

const FAMILIA_LIMITS: PlanLimits = {
  max_accounts: null,
  max_hub_members: 3,
  monthly_ai_messages: 500,
  extra_user_price_cents: 2990,
};

export function usePlanLimits(): PlanLimitsState {
  const { user } = useAuth();
  const { subscription, isInTrial, isLoading: subLoading } = useSubscription();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["plan-limits", user?.id, subscription?.plan_id],
    enabled: !!user?.id,
    queryFn: async () => {
      const period = new Date().toISOString().slice(0, 7);
      const [planRes, accountsRes, cardsRes, walletsRes, terminalsRes, membersRes, usageRes] = await Promise.all([
        subscription?.plan_id
          ? supabase.from("subscription_plans").select("*").eq("id", subscription.plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("bank_accounts").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("credit_cards").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("wallets").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("card_terminals").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("owner_id", user!.id).eq("status", "active"),
        supabase.from("ai_usage_counters").select("messages_used").eq("user_id", user!.id).eq("period_year_month", period).maybeSingle(),
      ]);

      const plan = planRes?.data as SubscriptionPlanLimits | null | undefined;
      return {
        plan,
        bankAccounts: accountsRes.count ?? 0,
        creditCards: cardsRes.count ?? 0,
        wallets: walletsRes.count ?? 0,
        terminals: terminalsRes.count ?? 0,
        accounts: (accountsRes.count ?? 0) + (cardsRes.count ?? 0) + (walletsRes.count ?? 0) + (terminalsRes.count ?? 0),
        hubMembers: membersRes.count ?? 0,
        aiMessagesThisMonth: (usageRes.data as UsageCounterRow | null)?.messages_used ?? 0,
      };
    },
  });

  const isTrialFullAccess = !!isInTrial;
  const planSlug: string = data?.plan?.slug ?? "individual";
  const effectivePlanSlug = isTrialFullAccess ? "familia" : planSlug;

  const hasPlan = !!data?.plan;

  const limits: PlanLimits = isTrialFullAccess
    ? FAMILIA_LIMITS
    : {
        max_accounts: hasPlan ? data.plan.max_accounts : 3,
        max_hub_members: data?.plan?.max_hub_members ?? 0,
        monthly_ai_messages: data?.plan?.monthly_ai_messages ?? 100,
        extra_user_price_cents: data?.plan?.extra_user_price_cents ?? 0,
      };

  const usage = {
    accounts: data?.accounts ?? 0,
    bankAccounts: data?.bankAccounts ?? 0,
    creditCards: data?.creditCards ?? 0,
    wallets: data?.wallets ?? 0,
    terminals: data?.terminals ?? 0,
    hubMembers: data?.hubMembers ?? 0,
    aiMessagesThisMonth: data?.aiMessagesThisMonth ?? 0,
  };

  const kindLabels: Record<AccountKind, string> = {
    bank: "contas bancárias",
    card: "cartões de crédito",
    wallet: "carteiras",
    terminal: "maquininhas",
  };

  const kindUsage = (kind: AccountKind) =>
    kind === "bank" ? usage.bankAccounts
    : kind === "card" ? usage.creditCards
    : kind === "wallet" ? usage.wallets
    : usage.terminals;

  return {
    isLoading: isLoading || subLoading,
    effectivePlanSlug,
    isTrialFullAccess,
    limits,
    usage,
    hubAllowed: limits.max_hub_members > 0,
    canCreateAccount: (kind?: AccountKind) => {
      if (limits.max_accounts == null) return { ok: true };
      // Per-kind limit: each category (bank, card, wallet, terminal) has its own cap = max_accounts.
      if (kind) {
        const current = kindUsage(kind);
        if (current >= limits.max_accounts) {
          return {
            ok: false,
            reason: `Seu plano permite até ${limits.max_accounts} ${kindLabels[kind]}. Faça upgrade para o Família para cadastros ilimitados.`,
          };
        }
        return { ok: true };
      }
      // Fallback (no kind): check if ANY category still has room.
      const anyRoom = (["bank", "card", "wallet", "terminal"] as AccountKind[]).some(
        (k) => kindUsage(k) < limits.max_accounts!,
      );
      if (!anyRoom) {
        return {
          ok: false,
          reason: `Seu plano permite até ${limits.max_accounts} de cada tipo (contas, cartões, carteiras, maquininhas). Faça upgrade para o Família.`,
        };
      }
      return { ok: true };
    },

    canCreateHubMember: () => {
      if (limits.max_hub_members <= 0) {
        return { ok: false, reason: "O EVA Hub é exclusivo do plano Família. Faça upgrade para gerenciar usuários adicionais." };
      }
      if (usage.hubMembers >= limits.max_hub_members) {
        return {
          ok: false,
          reason: `Você atingiu o limite de ${limits.max_hub_members} membros do plano Família. Compre usuários extras (R$ 29,90/usuário) para adicionar mais.`,
        };
      }
      return { ok: true };
    },
    canUseAI: () => {
      if (limits.monthly_ai_messages == null) return { ok: true, remaining: null };
      const remaining = limits.monthly_ai_messages - usage.aiMessagesThisMonth;
      if (remaining <= 0) {
        return {
          ok: false,
          remaining: 0,
          reason: `Você atingiu sua cota mensal de ${limits.monthly_ai_messages} mensagens da EVA. Faça upgrade ou aguarde o próximo ciclo.`,
        };
      }
      return { ok: true, remaining };
    },
    refetch,
  };
}

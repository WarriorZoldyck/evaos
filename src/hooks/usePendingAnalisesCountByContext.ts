import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";

export interface PendingCountsByContext {
  personal: number;
  byCompanyId: Record<string, number>;
  total: number;
}

export function usePendingAnalisesCountByContext() {
  const effectiveUserId = useEffectiveUserId();

  const { data } = useQuery<PendingCountsByContext>({
    queryKey: ["ai-pending-by-context", effectiveUserId],
    queryFn: async () => {
      const empty: PendingCountsByContext = { personal: 0, byCompanyId: {}, total: 0 };
      if (!effectiveUserId) return empty;
      const { data: rows, error } = await supabase
        .from("ai_pending_transactions")
        .select("company_id")
        .eq("user_id", effectiveUserId)
        .eq("status", "pending");
      if (error || !rows) return empty;
      const byCompanyId: Record<string, number> = {};
      let personal = 0;
      for (const r of rows as { company_id: string | null }[]) {
        if (r.company_id) {
          byCompanyId[r.company_id] = (byCompanyId[r.company_id] || 0) + 1;
        } else {
          personal += 1;
        }
      }
      return { personal, byCompanyId, total: rows.length };
    },
    enabled: !!effectiveUserId,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  return data ?? { personal: 0, byCompanyId: {}, total: 0 };
}

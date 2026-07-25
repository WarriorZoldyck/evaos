import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

export interface AIPendingTransaction {
  id: string;
  user_id: string;
  source: string;
  status: string;
  confidence_score: number | null;
  ai_response_message: string | null;
  original_message: string | null;
  reviewed_at: string | null;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  subcategory: string | null;
  subcategory2: string | null;
  competence_date: string | null;
  payment_date: string | null;
  transaction_status: string | null;
  bank_account_id: string | null;
  wallet_id: string | null;
  credit_card_id: string | null;
  card_terminal_id: string | null;
  company_id: string | null;
  payment_method: string | null;
  supplier_id: string | null;
  client_id: string | null;
  contact_name: string | null;
  notes: string | null;
  attachment_url: string | null;
  barcode: string | null;
  installments: number | null;
  installment_number: number | null;
  installments_total: number | null;
  series_id: string | null;
  original_amount: number | null;
  created_at: string;
}

async function approveSingle(pending: AIPendingTransaction) {
  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: pending.user_id,
    description: pending.description,
    amount: pending.amount,
    type: pending.type as "receita" | "despesa",
    category: pending.category || "",
    subcategory: pending.subcategory,
    subcategory2: pending.subcategory2,
    competence_date: pending.competence_date || new Date().toISOString().split("T")[0],
    payment_date: pending.payment_date || new Date().toISOString().split("T")[0],
    status: (pending.transaction_status || "Pago") as "Pago" | "Pendente",
    bank_account_id: pending.bank_account_id,
    wallet_id: pending.wallet_id,
    credit_card_id: pending.credit_card_id,
    card_terminal_id: pending.card_terminal_id,
    company_id: pending.company_id,
    payment_method: pending.payment_method,
    supplier_id: pending.supplier_id,
    client_id: pending.client_id,
    contact_name: pending.contact_name,
    notes: pending.notes,
    attachment_url: pending.attachment_url,
    barcode: pending.barcode,
    installments: pending.installments,
    installment_number: pending.installment_number,
    installments_total: pending.installments_total,
    series_id: pending.series_id,
    original_amount: pending.original_amount,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("ai_pending_transactions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", pending.id);
  if (updateError) throw updateError;
}

export function useAIPendingTransactions() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const queryClient = useQueryClient();

  const { data: pendingTransactions = [], isLoading } = useQuery({
    queryKey: ["ai-pending-transactions", effectiveUserId, selectedCompanyId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      let query = supabase
        .from("ai_pending_transactions")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIPendingTransaction[];
    },
    enabled: !!effectiveUserId,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["ai-pending-count", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return 0;
      const { count, error } = await supabase
        .from("ai_pending_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", effectiveUserId)
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!effectiveUserId,
    refetchInterval: 30000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-pending-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["ai-pending-count"] });
    queryClient.invalidateQueries({ queryKey: ["ai-pending-by-context"] });
    queryClient.invalidateQueries({ queryKey: ["ai-duplicate-suspects"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const approveMutation = useMutation({
    mutationFn: approveSingle,
    onSuccess: () => {
      toast.success("Lançamento aprovado e registrado!");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro ao aprovar: " + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento rejeitado.");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro ao rejeitar: " + err.message),
  });

  const approveAllMutation = useMutation({
    mutationFn: async (items: AIPendingTransaction[]) => {
      for (const item of items) {
        await approveSingle(item);
      }
    },
    onSuccess: () => {
      toast.success("Todas as parcelas aprovadas!");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro ao aprovar parcelas: " + err.message),
  });

  const rejectAllMutation = useMutation({
    mutationFn: async (items: AIPendingTransaction[]) => {
      const ids = items.map((i) => i.id);
      const { error } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas as parcelas rejeitadas.");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro ao rejeitar parcelas: " + err.message),
  });

  const updatePendingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AIPendingTransaction> }) => {
      const { error } = await supabase
        .from("ai_pending_transactions")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento atualizado!");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });

  const pending = pendingTransactions.filter((t) => t.status === "pending");
  const reviewed = pendingTransactions.filter((t) => t.status !== "pending" && t.status !== "duplicate_suspect");
  const duplicateSuspects = pendingTransactions.filter((t) => t.status === "duplicate_suspect");

  // --- Duplicate suspect query without company_id filter ---
  const { data: allSuspects = [] } = useQuery({
    queryKey: ["ai-duplicate-suspects", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("ai_pending_transactions")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("status", "duplicate_suspect")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AIPendingTransaction[];
    },
    enabled: !!effectiveUserId,
  });

  // Group duplicate suspects into clusters by normalized fingerprint key
  const normalizeDesc = (d: string) => (d || "").toLowerCase().replace(/\s+/g, " ").trim();

  const duplicateClusters: AIPendingTransaction[][] = [];
  const clusterMap = new Map<string, AIPendingTransaction[]>();

  // Also check pending items that share fingerprint with suspects
  const allForClustering = [...allSuspects, ...pending];
  for (const item of allForClustering) {
    const key = `${Math.abs(item.amount)}|${normalizeDesc(item.description)}|${item.competence_date || ""}`;
    const list = clusterMap.get(key) || [];
    list.push(item);
    clusterMap.set(key, list);
  }

  // Clusters with 2+ items
  const usedSuspectIds = new Set<string>();
  for (const [, items] of clusterMap) {
    if (items.length > 1) {
      const unique = Array.from(new Map(items.map(i => [i.id, i])).values());
      if (unique.length > 1) {
        duplicateClusters.push(unique);
        unique.forEach(i => usedSuspectIds.add(i.id));
      }
    }
  }

  // Orphan suspects (no matching pair) — show as cluster of 1
  for (const suspect of allSuspects) {
    if (!usedSuspectIds.has(suspect.id)) {
      duplicateClusters.push([suspect]);
    }
  }

  const keepOneMutation = useMutation({
    mutationFn: async ({ keepId }: { keepId: string }) => {
      // Only move the clicked item to pending. The others remain as duplicate_suspect
      // so the user can decide each one individually (or use "Rejeitar Todos").
      const { error: keepError } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "pending" })
        .eq("id", keepId);
      if (keepError) throw keepError;
    },
    onSuccess: () => {
      toast.success("Item mantido e movido para Pendentes. Os demais continuam aguardando sua decisão.");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const keepAllMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "pending" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcados como não-duplicatas!");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const rejectClusterMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Duplicatas rejeitadas!");
      invalidateAll();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return {
    pendingTransactions: pending,
    reviewedTransactions: reviewed,
    duplicateClusters,
    pendingCount,
    isLoading,
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    approveAll: approveAllMutation.mutate,
    rejectAll: rejectAllMutation.mutate,
    updatePending: updatePendingMutation.mutate,
    updatePendingAsync: updatePendingMutation.mutateAsync,
    keepOne: keepOneMutation.mutate,
    keepAll: keepAllMutation.mutate,
    rejectCluster: rejectClusterMutation.mutate,
    isApproving: approveMutation.isPending || approveAllMutation.isPending,
    isRejecting: rejectMutation.isPending || rejectAllMutation.isPending,
  };
}

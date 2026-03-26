import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

export function useAIPendingTransactions() {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const queryClient = useQueryClient();

  const { data: pendingTransactions = [], isLoading } = useQuery({
    queryKey: ["ai-pending-transactions", user?.id, selectedCompanyId],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from("ai_pending_transactions")
        .select("*")
        .eq("user_id", user.id)
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
    enabled: !!user?.id,
  });

  // Count ALL pending (across all contexts) for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["ai-pending-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("ai_pending_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // poll every 30s
  });

  const approveMutation = useMutation({
    mutationFn: async (pending: AIPendingTransaction) => {
      // Insert into transactions
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

      // Mark as approved
      const { error: updateError } = await supabase
        .from("ai_pending_transactions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", pending.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Lançamento aprovado e registrado!");
      queryClient.invalidateQueries({ queryKey: ["ai-pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar: " + err.message);
    },
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
      queryClient.invalidateQueries({ queryKey: ["ai-pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-pending-count"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao rejeitar: " + err.message);
    },
  });

  const pending = pendingTransactions.filter((t) => t.status === "pending");
  const reviewed = pendingTransactions.filter((t) => t.status !== "pending");

  return {
    pendingTransactions: pending,
    reviewedTransactions: reviewed,
    pendingCount,
    isLoading,
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}

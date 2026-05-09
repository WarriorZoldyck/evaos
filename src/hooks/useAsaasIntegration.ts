import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface AsaasIntegration {
  id: string;
  user_id: string;
  company_id: string | null;
  bank_account_id: string;
  initial_balance_synced: number | null;
  last_sync_at: string | null;
  sync_status: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useAsaasIntegration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["asaas_integrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asaas_integrations")
        .select("id, user_id, company_id, bank_account_id, initial_balance_synced, last_sync_at, sync_status, last_error, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as AsaasIntegration[]) || [];
    },
  });

  const connect = useMutation({
    mutationFn: async (input: {
      api_key: string;
      mode: "new_account" | "link_existing";
      bank_account_id?: string;
      account_name?: string;
      company_id?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("asaas-connect-account", { body: input });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Conta Asaas conectada!" });
      qc.invalidateQueries({ queryKey: ["asaas_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: async (integration_id?: string) => {
      const { data, error } = await supabase.functions.invoke("asaas-sync", {
        body: integration_id ? { integration_id } : {},
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída" });
      qc.invalidateQueries({ queryKey: ["asaas_integrations"] });
      qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: async (integration_id: string) => {
      const { data, error } = await supabase.functions.invoke("asaas-disconnect-account", { body: { integration_id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Integração removida" });
      qc.invalidateQueries({ queryKey: ["asaas_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" }),
  });

  return { list, connect, sync, disconnect };
}

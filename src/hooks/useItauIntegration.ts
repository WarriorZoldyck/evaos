import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ItauIntegration {
  id: string;
  user_id: string;
  company_id: string | null;
  bank_account_id: string | null;
  client_id: string;
  agency: string | null;
  account_number: string | null;
  account_digit: string | null;
  environment: "sandbox" | "production";
  last_sync_at: string | null;
  sync_status: string | null;
  last_error: string | null;
  initial_balance_synced: number | null;
  created_at: string;
  updated_at: string;
}

export function useItauIntegration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["itau_integrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itau_integrations" as any)
        .select(
          "id, user_id, company_id, bank_account_id, client_id, agency, account_number, account_digit, environment, last_sync_at, sync_status, last_error, initial_balance_synced, created_at, updated_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown) as ItauIntegration[]) || [];
    },
  });

  const connect = useMutation({
    mutationFn: async (input: {
      client_id: string;
      client_secret: string;
      certificate?: string;
      environment: "sandbox" | "production";
      agency?: string;
      account_number?: string;
      account_digit?: string;
      mode: "new_account" | "link_existing";
      bank_account_id?: string;
      account_name?: string;
      company_id?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("itau-connect-account", { body: input });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Conta Itaú conectada!" });
      qc.invalidateQueries({ queryKey: ["itau_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: async (integration_id?: string) => {
      const { data, error } = await supabase.functions.invoke("itau-sync", {
        body: integration_id ? { integration_id } : {},
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída" });
      qc.invalidateQueries({ queryKey: ["itau_integrations"] });
      qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: async (integration_id: string) => {
      const { data, error } = await supabase.functions.invoke("itau-disconnect-account", { body: { integration_id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Integração removida" });
      qc.invalidateQueries({ queryKey: ["itau_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" }),
  });

  return { list, connect, sync, disconnect };
}

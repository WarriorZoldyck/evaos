import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface PluggyIntegration {
  id: string;
  user_id: string;
  company_id: string | null;
  bank_account_id: string;
  pluggy_item_id: string;
  pluggy_account_id: string;
  institution_name: string | null;
  connector_id: number | null;
  initial_balance_synced: number | null;
  last_sync_at: string | null;
  sync_status: string;
  last_error: string | null;
  item_status: string | null;
  created_at: string;
  updated_at: string;
}

export function usePluggyIntegration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["pluggy_integrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_integrations" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as PluggyIntegration[];
    },
  });

  const requestConnectToken = async (item_id?: string) => {
    const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
      body: item_id ? { item_id } : {},
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return (data as any)?.accessToken as string;
  };

  const finalizeConnect = useMutation({
    mutationFn: async (input: {
      item_id: string;
      account_id?: string;
      mode: "new_account" | "link_existing";
      bank_account_id?: string;
      account_name?: string;
      company_id?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-account", { body: input });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Conta Itaú conectada!" });
      qc.invalidateQueries({ queryKey: ["pluggy_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: async (integration_id?: string) => {
      const { data, error } = await supabase.functions.invoke("pluggy-sync", {
        body: integration_id ? { integration_id } : {},
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída" });
      qc.invalidateQueries({ queryKey: ["pluggy_integrations"] });
      qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: async (integration_id: string) => {
      const { data, error } = await supabase.functions.invoke("pluggy-disconnect-account", { body: { integration_id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Integração removida" });
      qc.invalidateQueries({ queryKey: ["pluggy_integrations"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" }),
  });

  return { list, requestConnectToken, finalizeConnect, sync, disconnect };
}

import { mapDatabaseError } from "@/lib/errorMapper";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useToast } from "@/hooks/use-toast";

export interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  created_at: string | null;
  user_id: string;
}

export interface Client {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  created_at: string | null;
  user_id: string;
}

export type ContactType = "supplier" | "client";

export function useContacts() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [supRes, cliRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("clients").select("*").order("name"),
    ]);

    if (supRes.data) setSuppliers(supRes.data);
    if (cliRes.data) setClients(cliRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createSupplier = async (data: { name: string; cnpj?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from("suppliers").insert({
      name: data.name,
      cnpj: data.cnpj || null,
      user_id: effectiveUserId,
    });
    if (error) {
      toast({ title: "Erro ao criar fornecedor", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Fornecedor criado!" });
    fetchContacts();
    return true;
  };

  const updateSupplier = async (id: string, data: { name: string; cnpj?: string }) => {
    const { error } = await supabase
      .from("suppliers")
      .update({ name: data.name, cnpj: data.cnpj || null })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar fornecedor", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Fornecedor atualizado!" });
    fetchContacts();
    return true;
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir fornecedor", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Fornecedor excluído!" });
    fetchContacts();
    return true;
  };

  const createClient = async (data: { name: string; cnpj_cpf?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from("clients").insert({
      name: data.name,
      cnpj_cpf: data.cnpj_cpf || null,
      user_id: effectiveUserId,
    });
    if (error) {
      toast({ title: "Erro ao criar cliente", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente criado!" });
    fetchContacts();
    return true;
  };

  const updateClient = async (id: string, data: { name: string; cnpj_cpf?: string }) => {
    const { error } = await supabase
      .from("clients")
      .update({ name: data.name, cnpj_cpf: data.cnpj_cpf || null })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar cliente", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente atualizado!" });
    fetchContacts();
    return true;
  };

  const deleteClient = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir cliente", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente excluído!" });
    fetchContacts();
    return true;
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpj && s.cnpj.includes(search))
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj_cpf && c.cnpj_cpf.includes(search))
  );

  return {
    suppliers: filteredSuppliers,
    clients: filteredClients,
    allSuppliers: suppliers,
    allClients: clients,
    loading,
    search,
    setSearch,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createClient,
    updateClient,
    deleteClient,
    refetch: fetchContacts,
  };
}

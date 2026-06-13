import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ResourceType = "company" | "bank_account" | "credit_card" | "card_terminal" | "wallet";

export interface MemberPermission {
  id: string;
  workspace_member_id: string;
  resource_type: ResourceType;
  resource_id: string;
}

export interface ResourceOption {
  id: string;
  name: string;
  type: ResourceType;
  /** null = Pessoal; otherwise vinculado à empresa de id == company_id */
  company_id: string | null;
}

export interface CompanyOption { id: string; name: string }

/**
 * Manage per-resource access for a single workspace member.
 */
export function useMemberPermissions(workspaceMemberId: string | null) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<MemberPermission[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!workspaceMemberId) return;
    const { data } = await supabase
      .from("workspace_member_permissions")
      .select("*")
      .eq("workspace_member_id", workspaceMemberId);
    if (data) setPermissions(data as MemberPermission[]);
  }, [workspaceMemberId]);

  const fetchOwnerResources = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [c, b, cc, ct, w] = await Promise.all([
      supabase.from("companies").select("id, name").eq("user_id", user.id),
      supabase.from("bank_accounts").select("id, name, company_id").eq("user_id", user.id),
      supabase.from("credit_cards").select("id, name, company_id").eq("user_id", user.id),
      supabase.from("card_terminals").select("id, name, company_id").eq("user_id", user.id),
      supabase.from("wallets").select("id, name, company_id").eq("user_id", user.id),
    ]);
    const companyList: CompanyOption[] = ((c.data as any[]) || []).map((r) => ({ id: r.id, name: r.name }));
    setCompanies(companyList);
    const all: ResourceOption[] = [
      ...companyList.map((r) => ({ id: r.id, name: r.name, type: "company" as const, company_id: r.id })),
      ...((b.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "bank_account" as const, company_id: r.company_id ?? null })),
      ...((cc.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "credit_card" as const, company_id: r.company_id ?? null })),
      ...((ct.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "card_terminal" as const, company_id: r.company_id ?? null })),
      ...((w.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "wallet" as const, company_id: r.company_id ?? null })),
    ];
    setResources(all);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPermissions();
    fetchOwnerResources();
  }, [fetchPermissions, fetchOwnerResources]);

  const togglePermission = async (resourceType: ResourceType, resourceId: string, granted: boolean) => {
    if (!workspaceMemberId) return;
    if (granted) {
      const { error } = await supabase
        .from("workspace_member_permissions")
        .insert({ workspace_member_id: workspaceMemberId, resource_type: resourceType, resource_id: resourceId });
      if (error) { toast.error("Erro ao conceder acesso"); return; }
    } else {
      const { error } = await supabase
        .from("workspace_member_permissions")
        .delete()
        .eq("workspace_member_id", workspaceMemberId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);
      if (error) { toast.error("Erro ao remover acesso"); return; }
    }
    await fetchPermissions();
  };

  const clearAll = async () => {
    if (!workspaceMemberId) return;
    const { error } = await supabase
      .from("workspace_member_permissions")
      .delete()
      .eq("workspace_member_id", workspaceMemberId);
    if (error) { toast.error("Erro ao limpar acesso"); return; }
    toast.success("Acesso liberado para tudo do dono");
    await fetchPermissions();
  };

  const isGranted = (type: ResourceType, id: string) =>
    permissions.some((p) => p.resource_type === type && p.resource_id === id);

  return { permissions, resources, companies, loading, togglePermission, clearAll, isGranted, hasAnyScope: permissions.length > 0 };
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkspaceMember {
  id: string;
  owner_id: string;
  member_user_id: string;
  member_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  workspace_id: string | null;
}

export interface AvailableWorkspace {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  role: string;
  member_id: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface OwnerProfile {
  full_name: string | null;
  companies: { id: string; name: string; cnpj: string }[];
}

export function useWorkspaceMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<AvailableWorkspace[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOwnerProfile = useCallback(async () => {
    if (!user) return;
    const [profileRes, companiesRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("companies").select("id, name, cnpj").eq("user_id", user.id),
    ]);
    setOwnerProfile({
      full_name: profileRes.data?.full_name || null,
      companies: (companiesRes.data as any[]) || [],
    });
  }, [user]);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    if (data) setWorkspaces(data as Workspace[]);
  }, [user]);

  const fetchMembers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMembers(data as WorkspaceMember[]);
    }
    setLoading(false);
  }, [user]);

  const fetchAvailableWorkspaces = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("member_user_id", user.id)
      .eq("status", "active");

    if (!error && data) {
      const ownerIds = [...new Set((data as WorkspaceMember[]).map((m) => m.owner_id))];
      const wsList: AvailableWorkspace[] = [];

      for (const ownerId of ownerIds) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", ownerId)
          .single();

        const memberRecord = (data as WorkspaceMember[]).find((m) => m.owner_id === ownerId);
        if (memberRecord) {
          wsList.push({
            owner_id: ownerId,
            owner_name: profile?.full_name || memberRecord.email || "Conta",
            owner_email: memberRecord.email,
            role: memberRecord.role,
            member_id: memberRecord.id,
          });
        }
      }
      setAvailableWorkspaces(wsList);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const appMeta = (user as any).app_metadata as Record<string, unknown> | undefined;
    if (appMeta?.hub_member === true || meta?.hub_member === true) {
      fetchAvailableWorkspaces();
    } else {
      Promise.all([fetchMembers(), fetchWorkspaces(), fetchOwnerProfile()]);
    }
  }, [user, fetchMembers, fetchAvailableWorkspaces, fetchWorkspaces, fetchOwnerProfile]);

  const createMember = async (name: string, email: string, password: string, role: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("create-hub-member", {
        body: { name, email, password, role },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success("Membro criado com sucesso!");
      await fetchMembers();
      return res.data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar membro");
      throw err;
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("id", memberId);
    if (error) toast.error("Erro ao atualizar role");
    else { toast.success("Role atualizado!"); await fetchMembers(); }
  };

  const suspendMember = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ status: "suspended" })
      .eq("id", memberId);
    if (error) toast.error("Erro ao suspender membro");
    else { toast.success("Membro suspenso!"); await fetchMembers(); }
  };

  const activateMember = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ status: "active" })
      .eq("id", memberId);
    if (error) toast.error("Erro ao ativar membro");
    else { toast.success("Membro ativado!"); await fetchMembers(); }
  };

  const createWorkspace = async (name: string, description?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("workspaces")
      .insert({ owner_id: user.id, name, description: description || null });
    if (error) toast.error("Erro ao criar área de trabalho");
    else { toast.success("Área de trabalho criada!"); await fetchWorkspaces(); }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspaceId);
    if (error) toast.error("Erro ao excluir área de trabalho");
    else { toast.success("Área de trabalho excluída!"); await fetchWorkspaces(); }
  };

  const assignMemberToWorkspace = async (memberId: string, workspaceId: string | null) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ workspace_id: workspaceId })
      .eq("id", memberId);
    if (error) toast.error("Erro ao atribuir área de trabalho");
    else { toast.success("Membro atualizado!"); await fetchMembers(); }
  };

  return {
    members,
    workspaces,
    availableWorkspaces,
    ownerProfile,
    loading,
    createMember,
    updateMemberRole,
    suspendMember,
    activateMember,
    createWorkspace,
    deleteWorkspace,
    assignMemberToWorkspace,
    refetch: fetchMembers,
  };
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";
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

export interface PendingInvitation {
  member_id: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  role: string;
}

export function useWorkspaceMembers() {
  const { user } = useAuth();
  const { refreshHubStatus } = useHub();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<AvailableWorkspace[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
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

  const fetchPendingInvitations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workspace_members")
      .select("id, owner_id, email, role")
      .eq("member_user_id", user.id)
      .eq("status", "pending");
    if (!data || data.length === 0) {
      setPendingInvitations([]);
      return;
    }
    const ownerIds = [...new Set(data.map((d: any) => d.owner_id))];
    const profilesById = new Map<string, string>();
    for (const oid of ownerIds) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", oid).single();
      if (p?.full_name) profilesById.set(oid, p.full_name);
    }
    setPendingInvitations(
      data.map((d: any) => ({
        member_id: d.id,
        owner_id: d.owner_id,
        owner_name: profilesById.get(d.owner_id) || d.email || "Conta",
        owner_email: d.email,
        role: d.role,
      }))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchMembers(),
      fetchWorkspaces(),
      fetchOwnerProfile(),
      fetchAvailableWorkspaces(),
      fetchPendingInvitations(),
    ]);
  }, [user, fetchMembers, fetchAvailableWorkspaces, fetchWorkspaces, fetchOwnerProfile, fetchPendingInvitations]);

  const createMember = async (name: string, email: string, password: string | undefined, role: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const body: Record<string, unknown> = { name, email, role };
      if (password) body.password = password;
      const res = await supabase.functions.invoke("create-hub-member", { body });

      if (res.error) {
        let msg = res.error.message;
        try {
          const ctx: any = (res.error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx?.text) {
            const txt = await ctx.text();
            try { msg = JSON.parse(txt)?.error || txt || msg; } catch { msg = txt || msg; }
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(res.data?.pending ? "Convite enviado! Aguardando aceitação do usuário." : "Membro criado com sucesso!");
      await fetchMembers();
      return res.data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar membro");
      throw err;
    }
  };

  const acceptInvitation = async (memberId: string) => {
    try {
      const res = await supabase.functions.invoke("respond-hub-invitation", { body: { memberId, action: "accept" } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Convite aceito!");
      await Promise.all([fetchPendingInvitations(), fetchAvailableWorkspaces(), refreshHubStatus()]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar convite");
    }
  };

  const rejectInvitation = async (memberId: string) => {
    try {
      const res = await supabase.functions.invoke("respond-hub-invitation", { body: { memberId, action: "reject" } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Convite recusado");
      await Promise.all([fetchPendingInvitations(), refreshHubStatus()]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao recusar convite");
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

  const setStatus = async (memberId: string, status: "active" | "suspended") => {
    try {
      const res = await supabase.functions.invoke("set-hub-member-status", { body: { memberId, status } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(status === "suspended" ? "Membro suspenso!" : "Membro ativado!");
      await fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar membro");
    }
  };

  const suspendMember = (memberId: string) => setStatus(memberId, "suspended");
  const activateMember = (memberId: string) => setStatus(memberId, "active");

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

  const deleteMember = async (memberId: string) => {
    try {
      const res = await supabase.functions.invoke("delete-hub-member", { body: { memberId } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Membro removido!");
      await fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover membro");
    }
  };

  const resetMemberPassword = async (memberId: string) => {
    try {
      const res = await supabase.functions.invoke("reset-hub-member-password", { body: { memberId } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Nova senha temporária: ${res.data?.tempPassword || "enviada"}`, { duration: 15000 });
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
  };

  return {
    members,
    workspaces,
    availableWorkspaces,
    pendingInvitations,
    ownerProfile,
    loading,
    createMember,
    updateMemberRole,
    suspendMember,
    activateMember,
    createWorkspace,
    deleteWorkspace,
    assignMemberToWorkspace,
    deleteMember,
    resetMemberPassword,
    acceptInvitation,
    rejectInvitation,
    refetch: fetchMembers,
    refetchInvitations: fetchPendingInvitations,
  };
}


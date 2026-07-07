import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logHubAction } from "@/hooks/useHubAuditLog";

interface HubContextType {
  isHubMember: boolean;
  impersonatingOwnerId: string | null;
  impersonatingOwnerName: string | null;
  impersonatingRole: string | null;
  setImpersonation: (ownerId: string, ownerName: string, role?: string) => void;
  exitImpersonation: () => void;
  isOwnerWithMembers: boolean;
  pendingInvitationsCount: number;
  loading: boolean;
  refreshHubStatus: () => Promise<void>;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isHubMember, setIsHubMember] = useState(false);
  const [impersonatingOwnerId, setImpersonatingOwnerId] = useState<string | null>(null);
  const [impersonatingOwnerName, setImpersonatingOwnerName] = useState<string | null>(null);
  const [impersonatingRole, setImpersonatingRole] = useState<string | null>(null);
  const [isOwnerWithMembers, setIsOwnerWithMembers] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshHubStatus = useCallback(async () => {
    if (!user) return;
    const [memberRes, ownerRes, pendingRes] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("owner_id, role")
        .eq("member_user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("member_user_id", user.id)
        .eq("status", "pending"),
    ]);
    const activeMemberships = (memberRes.data || []) as Array<{ owner_id: string; role: string | null }>;
    const hubMember = activeMemberships.length > 0;
    setIsHubMember(hubMember);
    setIsOwnerWithMembers((ownerRes.count ?? 0) > 0);
    setPendingInvitationsCount(pendingRes.count ?? 0);

    if (impersonatingOwnerId && !activeMemberships.some((m) => m.owner_id === impersonatingOwnerId)) {
      setImpersonatingOwnerId(null);
      setImpersonatingOwnerName(null);
      setImpersonatingRole(null);
    }
  }, [user, impersonatingOwnerId]);

  useEffect(() => {
    if (!user) {
      setIsHubMember(false);
      setIsOwnerWithMembers(false);
      setPendingInvitationsCount(0);
      setImpersonatingOwnerId(null);
      setImpersonatingOwnerName(null);
      setImpersonatingRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    refreshHubStatus().finally(() => setLoading(false));
  }, [user, refreshHubStatus]);

  const setImpersonation = (ownerId: string, ownerName: string, role: string = "viewer") => {
    setImpersonatingOwnerId(ownerId);
    setImpersonatingOwnerName(ownerName);
    setImpersonatingRole(role);
    if (user) {
      logHubAction({
        actorUserId: user.id, ownerId,
        action: "impersonation_start",
        payload: { role, ownerName },
      });
    }
  };

  const exitImpersonation = () => {
    if (user && impersonatingOwnerId) {
      logHubAction({
        actorUserId: user.id,
        ownerId: impersonatingOwnerId,
        action: "impersonation_exit",
        payload: { role: impersonatingRole },
      });
    }
    setImpersonatingOwnerId(null);
    setImpersonatingOwnerName(null);
    setImpersonatingRole(null);
  };

  return (
    <HubContext.Provider
      value={{
        isHubMember,
        impersonatingOwnerId,
        impersonatingOwnerName,
        impersonatingRole,
        setImpersonation,
        exitImpersonation,
        isOwnerWithMembers,
        pendingInvitationsCount,
        loading,
        refreshHubStatus,
      }}
    >
      {children}
    </HubContext.Provider>
  );
}

export function useHub() {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error("useHub must be used within a HubProvider");
  }
  return context;
}

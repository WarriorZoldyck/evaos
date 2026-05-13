import React, { createContext, useContext, useState, useEffect } from "react";
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
  loading: boolean;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

const STORAGE_KEY = "eva.hub.impersonation";

type Persisted = { ownerId: string; ownerName: string; role: string | null; userId: string };

function loadPersisted(userId: string): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch { return null; }
}

export function HubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isHubMember, setIsHubMember] = useState(false);
  const [impersonatingOwnerId, setImpersonatingOwnerId] = useState<string | null>(null);
  const [impersonatingOwnerName, setImpersonatingOwnerName] = useState<string | null>(null);
  const [impersonatingRole, setImpersonatingRole] = useState<string | null>(null);
  const [isOwnerWithMembers, setIsOwnerWithMembers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsHubMember(false);
      setIsOwnerWithMembers(false);
      setImpersonatingOwnerId(null);
      setImpersonatingOwnerName(null);
      setImpersonatingRole(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setLoading(false);
      return;
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const appMeta = (user as any).app_metadata as Record<string, unknown> | undefined;
    const hubMember = appMeta?.hub_member === true || meta?.hub_member === true;
    setIsHubMember(hubMember);

    // Restore persisted impersonation (only for hub members)
    if (hubMember) {
      const persisted = loadPersisted(user.id);
      if (persisted) {
        setImpersonatingOwnerId(persisted.ownerId);
        setImpersonatingOwnerName(persisted.ownerName);
        setImpersonatingRole(persisted.role);
      }
    }

    const checkOwner = async () => {
      if (!hubMember) {
        const { count } = await supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id);
        setIsOwnerWithMembers((count ?? 0) > 0);
      } else {
        setIsOwnerWithMembers(false);
      }
      setLoading(false);
    };

    checkOwner();
  }, [user]);

  const setImpersonation = (ownerId: string, ownerName: string, role: string = "viewer") => {
    setImpersonatingOwnerId(ownerId);
    setImpersonatingOwnerName(ownerName);
    setImpersonatingRole(role);
    if (user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ownerId, ownerName, role, userId: user.id,
        } satisfies Persisted));
      } catch {}
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
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
        loading,
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

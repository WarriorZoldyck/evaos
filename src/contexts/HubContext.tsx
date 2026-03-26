import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface HubContextType {
  isHubMember: boolean;
  impersonatingOwnerId: string | null;
  impersonatingOwnerName: string | null;
  setImpersonation: (ownerId: string, ownerName: string) => void;
  exitImpersonation: () => void;
  isOwnerWithMembers: boolean;
  loading: boolean;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isHubMember, setIsHubMember] = useState(false);
  const [impersonatingOwnerId, setImpersonatingOwnerId] = useState<string | null>(null);
  const [impersonatingOwnerName, setImpersonatingOwnerName] = useState<string | null>(null);
  const [isOwnerWithMembers, setIsOwnerWithMembers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsHubMember(false);
      setIsOwnerWithMembers(false);
      setImpersonatingOwnerId(null);
      setImpersonatingOwnerName(null);
      setLoading(false);
      return;
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const hubMember = meta?.hub_member === true;
    setIsHubMember(hubMember);

    // Check if this user is an owner with members
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

  const setImpersonation = (ownerId: string, ownerName: string) => {
    setImpersonatingOwnerId(ownerId);
    setImpersonatingOwnerName(ownerName);
  };

  const exitImpersonation = () => {
    setImpersonatingOwnerId(null);
    setImpersonatingOwnerName(null);
  };

  return (
    <HubContext.Provider
      value={{
        isHubMember,
        impersonatingOwnerId,
        impersonatingOwnerName,
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

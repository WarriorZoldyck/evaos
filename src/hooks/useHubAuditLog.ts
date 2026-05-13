import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AuditEntry = {
  id: string;
  actor_user_id: string;
  owner_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
};

/**
 * Fire-and-forget logger. Caller passes the effective owner_id (the owner being impersonated).
 * If actorUserId === ownerId we skip (owner acting on own data isn't impersonation).
 */
export async function logHubAction(params: {
  actorUserId: string;
  ownerId: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
}) {
  if (!params.ownerId || !params.actorUserId || params.actorUserId === params.ownerId) return;
  try {
    await supabase.from("hub_audit_log").insert({
      actor_user_id: params.actorUserId,
      owner_id: params.ownerId,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      payload: params.payload ?? {},
    });
  } catch (e) {
    console.warn("hub audit log failed", e);
  }
}

export function useHubAuditLog(opts?: { limit?: number }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("hub_audit_log")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(opts?.limit ?? 1000);
      if (error) throw error;

      const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_user_id)));
      let profilesById: Record<string, { full_name: string | null }> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }

      // pull email from workspace_members
      const { data: members } = await supabase
        .from("workspace_members")
        .select("member_user_id, member_email")
        .eq("owner_id", user.id);
      const emailsById: Record<string, string> = Object.fromEntries(
        (members ?? []).map((m: any) => [m.member_user_id, m.member_email]),
      );

      setEntries(
        (data ?? []).map((r: any) => ({
          ...r,
          actor_name: profilesById[r.actor_user_id]?.full_name ?? null,
          actor_email: emailsById[r.actor_user_id] ?? null,
        })),
      );
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }, [user, opts?.limit]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, loading, error, refetch: fetchEntries };
}

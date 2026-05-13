import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";

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

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX = 5000;

/**
 * Fire-and-forget logger. Skipped when actor === owner (not an impersonation).
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
    await supabase.from("hub_audit_log").insert([{
      actor_user_id: params.actorUserId,
      owner_id: params.ownerId,
      action: params.action,
      resource_type: params.resourceType ?? undefined,
      resource_id: params.resourceId ?? undefined,
      payload: (params.payload ?? {}) as any,
    }]);
  } catch (e) {
    console.warn("hub audit log failed", e);
  }
}

/**
 * Hook returning a `withAudit` wrapper. Use it in write hooks to log only when
 * the current user is impersonating an owner. Bulk operations should pass a
 * `count` in payload instead of calling once per item.
 *
 * Example:
 *   const { withAudit } = useAuditedAction();
 *   await withAudit({ action: "transaction_create", resourceType: "transaction" }, async () => {
 *     return supabase.from("transactions").insert(...);
 *   });
 */
export function useAuditedAction() {
  const { user } = useAuth();
  const { impersonatingOwnerId } = useHub();

  const withAudit = useCallback(
    async <T>(
      meta: {
        action: string;
        resourceType?: string;
        resourceId?: string;
        payload?: Record<string, unknown>;
      },
      fn: () => Promise<T>,
    ): Promise<T> => {
      const result = await fn();
      if (user && impersonatingOwnerId) {
        // fire-and-forget; never blocks the actual operation
        logHubAction({
          actorUserId: user.id,
          ownerId: impersonatingOwnerId,
          action: meta.action,
          resourceType: meta.resourceType,
          resourceId: meta.resourceId,
          payload: meta.payload,
        });
      }
      return result;
    },
    [user, impersonatingOwnerId],
  );

  return { withAudit, isImpersonating: !!impersonatingOwnerId };
}

export function useHubAuditLog(opts?: { page?: number; pageSize?: number }) {
  const { user } = useAuth();
  const page = opts?.page ?? 0;
  const pageSize = opts?.pageSize ?? AUDIT_PAGE_SIZE;
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("hub_audit_log")
        .select("*", { count: "exact" })
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setTotalCount(count ?? 0);

      const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_user_id)));
      let profilesById: Record<string, { full_name: string | null }> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }

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
  }, [user, page, pageSize]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, totalCount, page, pageSize, loading, error, refetch: fetchEntries };
}

/**
 * Fetch up to AUDIT_EXPORT_MAX rows for export (CSV / PDF).
 * Returns `{ rows, truncated }`.
 */
export async function fetchAuditForExport(ownerId: string) {
  const { data, error } = await supabase
    .from("hub_audit_log")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(AUDIT_EXPORT_MAX);
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
  const { data: members } = await supabase
    .from("workspace_members")
    .select("member_user_id, member_email")
    .eq("owner_id", ownerId);
  const emailsById: Record<string, string> = Object.fromEntries(
    (members ?? []).map((m: any) => [m.member_user_id, m.member_email]),
  );

  const rows: AuditEntry[] = (data ?? []).map((r: any) => ({
    ...r,
    actor_name: profilesById[r.actor_user_id]?.full_name ?? null,
    actor_email: emailsById[r.actor_user_id] ?? null,
  }));
  return { rows, truncated: rows.length >= AUDIT_EXPORT_MAX };
}

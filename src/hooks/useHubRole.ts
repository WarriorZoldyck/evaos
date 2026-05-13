import { useHub } from "@/contexts/HubContext";

/**
 * Returns the role the current user has against the effective owner context:
 * - "owner"  → user is the data owner (full access)
 * - "admin" | "editor" | "viewer" → impersonating a hub owner with this role
 *
 * Use canWrite() to gate edit/delete UI.
 */
export function useHubRole() {
  const { isHubMember, impersonatingOwnerId, impersonatingRole } = useHub();

  const role: "owner" | "admin" | "editor" | "viewer" =
    isHubMember && impersonatingOwnerId
      ? ((impersonatingRole as any) || "viewer")
      : "owner";

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isEditor: role === "editor",
    isViewer: role === "viewer",
    canRead: true,
    canWrite: role === "owner" || role === "admin" || role === "editor",
    canDelete: role === "owner" || role === "admin",
  };
}

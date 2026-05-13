import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";

/**
 * Returns the user_id under which data should be created/queried.
 * - Normal users: their own auth.uid()
 * - Hub members during impersonation: the owner's user_id
 *
 * Use this for any INSERT/UPDATE that sets `user_id` and any read filter
 * scoped to ownership (`.eq("user_id", ...)`).
 *
 * Do NOT use this for the user's own profile/settings (full_name, form prefs,
 * whatsapp number, etc.) — those should remain tied to `user.id`.
 */
export function useEffectiveUserId(): string | undefined {
  const { user } = useAuth();
  const { impersonatingOwnerId } = useHub();
  return impersonatingOwnerId || user?.id;
}

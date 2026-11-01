import { supabase } from "@/integrations/supabase/client";

/** Notification failures must never undo or misreport a successful approval. */
export async function notifyApprovalBudget(pendingId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("budget-approval-notify", { body: { pending_id: pendingId } });
    if (error) console.error("Budget approval notification failed", error.message);
  } catch (error) {
    console.error("Budget approval notification unavailable", error);
  }
}
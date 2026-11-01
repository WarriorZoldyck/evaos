import { describe, expect, it } from "vitest";
import { shouldSendBudgetFollowUp } from "../../supabase/functions/_shared/budget-insight";

describe("budget follow-up approval boundary", () => {
  it("never notifies for pending submission", () => {
    expect(shouldSendBudgetFollowUp("pending", "tx-1")).toBe(false);
  });
  it("never notifies for rejection", () => {
    expect(shouldSendBudgetFollowUp("rejected", "tx-1")).toBe(false);
  });
  it("requires the registered transaction identity", () => {
    expect(shouldSendBudgetFollowUp("approved", null)).toBe(false);
    expect(shouldSendBudgetFollowUp("approved", "tx-1")).toBe(true);
  });
});
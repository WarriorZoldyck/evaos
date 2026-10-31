import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csvSecurity";
import { hasSecret, isOwnedKnowledgePath, isCompanyOwner } from "../../supabase/functions/_shared/access-guards";

describe("security boundaries", () => {
  it("blocks spreadsheet formulas, including indented report categories", () => {
    for (const value of ['=HYPERLINK("https://example.invalid")', '+SUM(1,2)', '-1+2', '@SUM(1,2)', '    =1+1', '\t=1+1', '\r=1+1']) {
      expect(escapeCsvCell(value).startsWith('"\'')).toBe(true);
    }
    expect(escapeCsvCell('Mercado; "João"')).toBe('"Mercado; ""João"""');
    expect(escapeCsvCell('125,50')).toBe('"125,50"');
  });
  it("denies cleanup without the configured administrative secret", () => {
    expect(hasSecret(null, 'test-only')).toBe(false);
    expect(hasSecret('wrong', 'test-only')).toBe(false);
    expect(hasSecret('', undefined)).toBe(false);
    expect(hasSecret('test-only', 'test-only')).toBe(true);
  });
  it("denies documents from other owners and path traversal", () => {
    expect(isOwnedKnowledgePath('owner/document.pdf', 'owner')).toBe(true);
    for (const path of ['other/document.pdf', 'owner/../other/doc.pdf', 'owner/%2e%2e/doc.pdf', 'owner/\\other/doc.pdf', 'owner/']) {
      expect(isOwnedKnowledgePath(path, 'owner')).toBe(false);
    }
  });
  it("denies bank accounts linked to another user's company", () => {
    expect(isCompanyOwner({ user_id: 'owner' }, 'owner')).toBe(true);
    expect(isCompanyOwner({ user_id: 'other' }, 'owner')).toBe(false);
    expect(isCompanyOwner(null, 'owner')).toBe(false);
  });
});
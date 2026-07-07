// Helper to apply multi-company filter for analytical pages (Dashboard, CashFlow, DRE).
// Other pages should use single-context filtering (selectedCompanyId/isPersonal) directly.

export interface CompanyFilterContext {
  effectiveUserId?: string | null;
  viewAll: boolean;
  selectedCompanyId: string | null;
  isPersonal: boolean;
  selectedCompanyIds: string[];
  personalSelected: boolean;
}

export function applyCompanyFilter(query: any, ctx: CompanyFilterContext) {
  let scopedQuery = ctx.effectiveUserId ? query.eq("user_id", ctx.effectiveUserId) : query;

  if (ctx.viewAll) return scopedQuery; // No company filter — show everything for the active owner only

  // Multi-select mode
  if (ctx.selectedCompanyIds.length > 0 || ctx.personalSelected) {
    const parts: string[] = [];
    if (ctx.personalSelected) parts.push("company_id.is.null");
    if (ctx.selectedCompanyIds.length > 0) {
      parts.push(`company_id.in.(${ctx.selectedCompanyIds.join(",")})`);
    }
    return scopedQuery.or(parts.join(","));
  }

  // Fallback to single-select
  if (ctx.isPersonal) return scopedQuery.is("company_id", null);
  if (ctx.selectedCompanyId) return scopedQuery.eq("company_id", ctx.selectedCompanyId);
  return scopedQuery;
}

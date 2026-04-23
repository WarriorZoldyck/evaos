// Helper to apply multi-company filter for analytical pages (Dashboard, CashFlow, DRE).
// Other pages should use single-context filtering (selectedCompanyId/isPersonal) directly.

export interface CompanyFilterContext {
  viewAll: boolean;
  selectedCompanyId: string | null;
  isPersonal: boolean;
  selectedCompanyIds: string[];
  personalSelected: boolean;
}

export function applyCompanyFilter(query: any, ctx: CompanyFilterContext) {
  if (ctx.viewAll) return query; // No company filter — show everything

  // Multi-select mode
  if (ctx.selectedCompanyIds.length > 0 || ctx.personalSelected) {
    const parts: string[] = [];
    if (ctx.personalSelected) parts.push("company_id.is.null");
    if (ctx.selectedCompanyIds.length > 0) {
      parts.push(`company_id.in.(${ctx.selectedCompanyIds.join(",")})`);
    }
    return query.or(parts.join(","));
  }

  // Fallback to single-select
  if (ctx.isPersonal) return query.is("company_id", null);
  if (ctx.selectedCompanyId) return query.eq("company_id", ctx.selectedCompanyId);
  return query;
}

import { useState, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useDashboardData, DashboardFilters } from "@/hooks/useDashboardData";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { BalanceProjectionChart } from "@/components/dashboard/BalanceProjectionChart";
import { CategorySummaryCharts } from "@/components/dashboard/CategorySummaryCharts";
import { UpcomingTransactions } from "@/components/dashboard/UpcomingTransactions";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";

export default function Dashboard() {
  const { isPersonal, companies, selectedCompanyId } = useCompany();
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const contextLabel = isPersonal ? "Pessoal" : selectedCompany?.name;

  const [filters, setFilters] = useState<DashboardFilters>({ period: "month" });
  const [refreshKey, setRefreshKey] = useState(0);

  // Force re-fetch when liquidation happens
  const handleLiquidated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const {
    summary,
    upcomingTransactions,
    categoryBreakdown,
    getProjectionData,
    performance,
    loading,
  } = useDashboardData(filters);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral — {contextLabel}
          </p>
        </div>
        <PeriodFilter filters={filters} onChange={setFilters} />
      </div>

      {/* Summary Cards */}
      <SummaryCards
        faturamento={summary.faturamento}
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        loading={loading}
      />

      {/* Charts Row */}
      <BalanceProjectionChart
        getProjectionData={getProjectionData}
        loading={loading}
      />

      {/* Category Doughnut Charts */}
      <CategorySummaryCharts
        revenueCategories={categoryBreakdown.revenueCategories}
        expenseCategories={categoryBreakdown.expenseCategories}
        loading={loading}
      />

      {/* Bottom Row: Upcoming + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <UpcomingTransactions
            transactions={upcomingTransactions}
            loading={loading}
            onLiquidated={handleLiquidated}
          />
        </div>
        <PerformanceCard
          avgDailySpending={performance.avgDailySpending}
          totalExpenses={performance.totalExpenses}
          daysInPeriod={performance.daysInPeriod}
          loading={loading}
        />
      </div>
    </div>
  );
}

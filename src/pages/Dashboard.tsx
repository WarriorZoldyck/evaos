import { useState, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useDashboardData, DashboardFilters } from "@/hooks/useDashboardData";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { BalanceProjectionChart } from "@/components/dashboard/BalanceProjectionChart";
import { CategorySummaryCharts } from "@/components/dashboard/CategorySummaryCharts";
import { UpcomingTransactions } from "@/components/dashboard/UpcomingTransactions";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { useAccounts } from "@/hooks/useAccounts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const { isPersonal, companies, selectedCompanyId } = useCompany();
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const contextLabel = isPersonal ? "Pessoal" : selectedCompany?.name;
  const { bankAccounts } = useAccounts();

  const [filters, setFilters] = useState<DashboardFilters>({ period: "month" });

  const {
    summary,
    upcomingTransactions,
    categoryBreakdown,
    getProjectionData,
    performance,
    creditCards,
    loading,
    refetch,
  } = useDashboardData(filters);

  // FIX #1: refetch triggers all queries inside the hook
  const handleLiquidated = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral — <span className="text-primary font-medium">{contextLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={filters.accountId || "__all__"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, accountId: v === "__all__" ? null : v }))
            }
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as contas</SelectItem>
              {bankAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PeriodFilter filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} />
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        faturamento={summary.faturamento}
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        entradaPrevista={summary.entradaPrevista}
        saidaPrevista={summary.saidaPrevista}
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
            creditCards={creditCards}
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

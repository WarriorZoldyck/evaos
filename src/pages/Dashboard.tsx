import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { useDashboardData, DashboardFilters, getDateRangeExported } from "@/hooks/useDashboardData";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { HeroSummaryCards } from "@/components/dashboard/HeroSummaryCards";
import { FinancialHealthBar } from "@/components/dashboard/FinancialHealthBar";
import { CategoryDetailGrid } from "@/components/dashboard/CategoryDetailGrid";
import { EvaInsights } from "@/components/dashboard/EvaInsights";
import { BalanceProjectionChart } from "@/components/dashboard/BalanceProjectionChart";
import { CategorySummaryCharts } from "@/components/dashboard/CategorySummaryCharts";
import { UpcomingTransactions } from "@/components/dashboard/UpcomingTransactions";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { useAccounts } from "@/hooks/useAccounts";
import { getPreviousPeriodRange, sumInRange } from "@/lib/dashboardInsights";
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
  const dateRange = useMemo(() => getDateRangeExported(filters), [filters]);
  const {
    transactions,
    allTransactions,
    summary,
    saldoAtual,
    upcomingTransactions,
    categoryBreakdown,
    getProjectionData,
    performance,
    creditCards,
    loading,
    refetch,
  } = useDashboardData(filters);

  const handleLiquidated = useCallback(() => {
    refetch();
  }, [refetch]);

  const prevRange = useMemo(
    () => getPreviousPeriodRange(dateRange.start, dateRange.end),
    [dateRange],
  );

  const prevEntradas = useMemo(
    () =>
      sumInRange(
        allTransactions as any,
        prevRange.start,
        prevRange.end,
        (t: any) => t.type === "receita",
      ),
    [allTransactions, prevRange],
  );
  const prevSaidas = useMemo(
    () =>
      sumInRange(
        allTransactions as any,
        prevRange.start,
        prevRange.end,
        (t: any) => t.type === "despesa",
      ),
    [allTransactions, prevRange],
  );

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

      {/* NEW: Hero 4-card row with sparklines + comparison */}
      <HeroSummaryCards
        allTransactions={allTransactions as any}
        start={dateRange.start}
        end={dateRange.end}
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        loading={loading}
      />

      {/* NEW: Financial Health bar */}
      <FinancialHealthBar
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        prevEntradas={prevEntradas}
        prevSaidas={prevSaidas}
        transactions={transactions as any}
        loading={loading}
      />

      {/* Existing summary cards (Saldo Atual, Faturamento, Previstas) — preserved */}
      <SummaryCards
        faturamento={summary.faturamento}
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        saldoAtual={saldoAtual}
        entradaPrevista={summary.entradaPrevista}
        saidaPrevista={summary.saidaPrevista}
        mdrBruto={summary.mdrBruto}
        mdrLiquido={summary.mdrLiquido}
        mdrTaxas={summary.mdrTaxas}
        mdrPercent={summary.mdrPercent}
        loading={loading}
        dateFrom={format(dateRange.start, "yyyy-MM-dd")}
        dateTo={format(dateRange.end, "yyyy-MM-dd")}
      />

      {/* Projection chart */}
      <BalanceProjectionChart
        getProjectionData={getProjectionData}
        loading={loading}
      />

      {/* Doughnuts originais (Receitas e Despesas) */}
      <CategorySummaryCharts
        revenueCategories={categoryBreakdown.revenueCategories}
        expenseCategories={categoryBreakdown.expenseCategories}
        loading={loading}
      />

      {/* NEW: Categorias detalhadas (estilo da referência) */}
      <CategoryDetailGrid
        categories={categoryBreakdown.expenseCategories}
        total={summary.saidas}
        allTransactions={allTransactions as any}
        currentStart={dateRange.start}
        currentEnd={dateRange.end}
        prevStart={prevRange.start}
        prevEnd={prevRange.end}
        loading={loading}
      />


      {/* Insights + Upcoming + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EvaInsights
          transactions={transactions as any}
          allTransactions={allTransactions as any}
          entradas={summary.entradas}
          saidas={summary.saidas}
          prevEntradas={prevEntradas}
          prevSaidas={prevSaidas}
        />
        <div className="lg:col-span-2">
          <UpcomingTransactions
            transactions={upcomingTransactions}
            creditCards={creditCards}
            loading={loading}
            onLiquidated={handleLiquidated}
          />
        </div>
      </div>

      <PerformanceCard
        avgDailySpending={performance.avgDailySpending}
        totalExpenses={performance.totalExpenses}
        daysInPeriod={performance.daysInPeriod}
        loading={loading}
      />
    </div>
  );
}

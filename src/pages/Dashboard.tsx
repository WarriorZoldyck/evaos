import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { useDashboardData, DashboardFilters, getDateRangeExported } from "@/hooks/useDashboardData";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { FinancialHealthBar } from "@/components/dashboard/FinancialHealthBar";
import { CategoryDetailGrid } from "@/components/dashboard/CategoryDetailGrid";
import { EvaInsights } from "@/components/dashboard/EvaInsights";
import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { UpcomingTransactions } from "@/components/dashboard/UpcomingTransactions";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { DashboardCreditCardsRow } from "@/components/dashboard/DashboardCreditCardsRow";
import { FaturamentoDetailModal } from "@/components/dashboard/FaturamentoDetailModal";
import { MdrDetailModal } from "@/components/dashboard/MdrDetailModal";
import { useMdrSummary } from "@/hooks/useMdrSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Percent } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { getPreviousPeriodRange, sumInRange, dailySeries } from "@/lib/dashboardInsights";
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
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  const [mdrModalOpen, setMdrModalOpen] = useState(false);
  const mdr = useMdrSummary();
  const dateRange = useMemo(() => getDateRangeExported(filters), [filters]);
  const {
    transactions,
    competenceTransactions,
    allTransactions,
    summary,
    saldoAtual,
    upcomingTransactions,
    categoryBreakdown,
    getProjectionData,
    performance,
    creditCards,
    internalTransfersTotal,
    resolveCategoryName,
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
  // Faturamento usa competência (não payment_date) para alinhar com o DRE
  const prevFaturamento = useMemo(() => {
    const fromStr = format(prevRange.start, "yyyy-MM-dd");
    const toStr = format(prevRange.end, "yyyy-MM-dd");
    return (allTransactions as any[])
      .filter(
        (t) =>
          t.type === "receita" &&
          t.competence_date &&
          t.competence_date >= fromStr &&
          t.competence_date <= toStr,
      )
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [allTransactions, prevRange]);
  const prevSaldo = prevEntradas - prevSaidas;

  // Sparkline series for current period
  const faturamentoSeries = useMemo(
    () => dailySeries(allTransactions as any, dateRange.start, dateRange.end, (t: any) => t.type === "receita" ? Number(t.amount) : 0),
    [allTransactions, dateRange],
  );
  const entradasSeries = faturamentoSeries;
  const saidasSeries = useMemo(
    () => dailySeries(allTransactions as any, dateRange.start, dateRange.end, (t: any) => t.type === "despesa" ? Number(t.amount) : 0),
    [allTransactions, dateRange],
  );
  const saldoSeries = useMemo(
    () => dailySeries(allTransactions as any, dateRange.start, dateRange.end, (t: any) => t.type === "receita" ? Number(t.amount) : -Number(t.amount)),
    [allTransactions, dateRange],
  );
  const marginSeries = useMemo(
    () => entradasSeries.map((e, i) => {
      const sv = saidasSeries[i]?.v || 0;
      return { date: e.date, v: e.v > 0 ? ((e.v - sv) / e.v) * 100 : 0 };
    }),
    [entradasSeries, saidasSeries],
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

      {/* Saúde Financeira (cabeçalho) */}
      <FinancialHealthBar
        entradas={summary.entradas}
        saidas={summary.saidas}
        saldo={summary.saldo}
        prevEntradas={prevEntradas}
        prevSaidas={prevSaidas}
        transactions={transactions as any}
        loading={loading}
      />

      {/* Cards principais (com comparativo + sparkline + margem) */}
      <SummaryCards
        faturamento={summary.faturamento}
        receitaOperacional={summary.receitaOperacional}
        unmappedRevenueCount={summary.unmappedRevenueCount}
        faturamentoNaoMapeado={summary.faturamentoNaoMapeado}
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
        prevFaturamento={prevFaturamento}
        prevEntradas={prevEntradas}
        prevSaidas={prevSaidas}
        prevSaldo={prevSaldo}
        internalTransfersTotal={internalTransfersTotal}
        faturamentoSeries={faturamentoSeries}

        entradasSeries={entradasSeries}
        saidasSeries={saidasSeries}
        saldoSeries={saldoSeries}
        marginSeries={marginSeries}
        onFaturamentoClick={() => setFaturamentoModalOpen(true)}
      />

      <FaturamentoDetailModal
        open={faturamentoModalOpen}
        onOpenChange={setFaturamentoModalOpen}
        competenceTransactions={competenceTransactions as any}
        total={summary.faturamento}
        prevTotal={prevFaturamento}
        dateFrom={format(dateRange.start, "yyyy-MM-dd")}
        dateTo={format(dateRange.end, "yyyy-MM-dd")}
      />

      {/* MDR — taxas de maquininha no mês */}
      <Card
        className="card-hover shadow-premium overflow-hidden relative group cursor-pointer"
        onClick={() => setMdrModalOpen(true)}
        role="button"
        aria-label="Abrir detalhes de MDR"
      >
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-destructive text-white shadow-lg shrink-0">
              <Percent className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                MDR pago no mês
              </p>
              <p className="text-xl font-bold font-display text-destructive">
                {mdr.loading
                  ? "..."
                  : mdr.currentMonth.fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              {!mdr.loading && (
                <p className="text-[11px] text-muted-foreground">
                  {mdr.currentMonth.effectiveRate.toFixed(2)}% sobre{" "}
                  {mdr.currentMonth.gross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{" "}
                  · {mdr.currentMonth.count} vendas
                </p>
              )}
            </div>
          </div>
          <span className="text-[11px] text-primary hidden sm:inline">Ver detalhes →</span>
        </CardContent>
      </Card>

      <MdrDetailModal open={mdrModalOpen} onOpenChange={setMdrModalOpen} />




      {/* Categorias — Receitas e Despesas (card unificado) */}
      <CategoryBreakdownCard
        revenueCategories={categoryBreakdown.revenueCategories}
        expenseCategories={categoryBreakdown.expenseCategories}
        totalReceitas={summary.entradas}
        totalDespesas={summary.saidas}
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

      {/* NEW: Cartões de Crédito (estilo carteira) */}
      <DashboardCreditCardsRow
        allTransactions={allTransactions as any}
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

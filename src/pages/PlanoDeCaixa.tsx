import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { CategoryReportTable } from "@/components/relatorios/CategoryReportTable";
import { useCashFlowData } from "@/hooks/useCashFlowData";
import { useAccounts } from "@/hooks/useAccounts";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PlanoDeCaixa() {
  const [filters, setFilters] = useState<DashboardFilters>({ period: "month" });
  const { bankAccounts } = useAccounts();
  const { revenueGroups, expenseGroups, totalRevenue, totalExpense, result, loading } =
    useCashFlowData("caixa", filters);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Plano de Caixa</h1>
          <p className="text-muted-foreground text-sm mt-1">Regime de caixa — somente transações pagas</p>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Fluxo de Caixa por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CategoryReportTable
            revenueGroups={revenueGroups}
            expenseGroups={expenseGroups}
            totalRevenue={totalRevenue}
            totalExpense={totalExpense}
            result={result}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

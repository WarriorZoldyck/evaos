import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

export default function DRE() {
  const [filters, setFilters] = useState<DashboardFilters>({ period: "month" });
  const { bankAccounts } = useAccounts();
  const { revenueGroups, expenseGroups, totalRevenue, totalExpense, result, loading } =
    useCashFlowData("competencia", filters);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">DRE por Competência</h1>
           <p className="text-muted-foreground text-sm mt-1">Regime de competência — todas as transações do período</p>
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
              <Info className="h-3.5 w-3.5" />
              Como funciona?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed max-w-lg">
              O <strong>DRE (Demonstrativo de Resultado)</strong> utiliza o <strong>regime de competência</strong>: considera <strong>todas as transações</strong> do período (pagas ou pendentes), agrupadas pela <strong>data de competência</strong>. Isso mostra o resultado econômico real, independente de quando o pagamento foi efetivamente realizado.
            </CollapsibleContent>
          </Collapsible>
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
            <FileText className="h-5 w-5 text-primary" />
            Demonstrativo de Resultado por Categoria
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

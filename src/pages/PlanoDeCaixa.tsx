import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { DRETable } from "@/components/relatorios/DRETable";
import { useCashFlowMonthly, type CashFlowMonthlyFilters } from "@/hooks/useCashFlowMonthly";
import { useAccounts } from "@/hooks/useAccounts";
import type { DREGranularity } from "@/hooks/useDREData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PlanoDeCaixa() {
  const [filters, setFilters] = useState<CashFlowMonthlyFilters>({
    year: new Date().getFullYear(),
    granularity: "monthly",
    accountId: null,
  });
  const { bankAccounts } = useAccounts();
  const {
    periods,
    revenueRows,
    expenseRows,
    monthlyRevenueTotals,
    monthlyExpenseTotals,
    monthlyResults,
    loading,
  } = useCashFlowMonthly("caixa", filters);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Plano de Caixa</h1>
          <p className="text-muted-foreground text-sm mt-1">Regime de caixa — somente transações pagas</p>
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
              <Info className="h-3.5 w-3.5" />
              Como funciona?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed max-w-lg">
              O <strong>Plano de Caixa</strong> utiliza o <strong>regime de caixa</strong>: considera apenas transações com status <strong>"Pago"</strong>, agrupadas pela <strong>data de pagamento</strong>. A visão mês a mês permite comparar a evolução do fluxo real do seu caixa ao longo do ano.
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={filters.accountId || "__all__"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, accountId: v === "__all__" ? null : v }))
            }
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
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

          <Select
            value={filters.granularity}
            onValueChange={(v) => setFilters((f) => ({ ...f, granularity: v as DREGranularity }))}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="semiannual">Semestral</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilters((f) => ({ ...f, year: f.year - 1 }))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(filters.year)} onValueChange={(v) => setFilters((f) => ({ ...f, year: Number(v) }))}>
              <SelectTrigger className="w-[80px] h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilters((f) => ({ ...f, year: f.year + 1 }))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Fluxo de Caixa por Categoria — {filters.year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DRETable
            periods={periods}
            revenueRows={revenueRows}
            expenseRows={expenseRows}
            monthlyRevenueTotals={monthlyRevenueTotals}
            monthlyExpenseTotals={monthlyExpenseTotals}
            monthlyResults={monthlyResults}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

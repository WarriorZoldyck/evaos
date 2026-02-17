import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DREPeriodFilter } from "@/components/relatorios/DREPeriodFilter";
import { DRETable } from "@/components/relatorios/DRETable";
import { useDREData, type DREFilters } from "@/hooks/useDREData";
import { useAccounts } from "@/hooks/useAccounts";

export default function DRE() {
  const [filters, setFilters] = useState<DREFilters>({
    year: new Date().getFullYear(),
    granularity: "monthly",
  });
  const { bankAccounts } = useAccounts();
  const { periods, revenueRows, expenseRows, monthlyRevenueTotals, monthlyExpenseTotals, monthlyResults, loading } =
    useDREData(filters);

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
        <DREPeriodFilter
          filters={filters}
          onChange={(partial) => setFilters((prev) => ({ ...prev, ...partial }))}
          bankAccounts={bankAccounts}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Demonstrativo de Resultado por Categoria
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

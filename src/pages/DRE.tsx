import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DREPeriodFilter } from "@/components/relatorios/DREPeriodFilter";
import { DRETable } from "@/components/relatorios/DRETable";
import { DRETableContabil } from "@/components/relatorios/DRETableContabil";
import { DREIndicatorCards } from "@/components/relatorios/DREIndicatorCards";
import { useDREData, type DREFilters } from "@/hooks/useDREData";
import { useAccounts } from "@/hooks/useAccounts";

export default function DRE() {
  const [filters, setFilters] = useState<DREFilters>({
    year: new Date().getFullYear(),
    granularity: "monthly",
    viewMode: "contabil",
  });
  const [showVerticalAnalysis, setShowVerticalAnalysis] = useState(false);
  const { bankAccounts } = useAccounts();
  const data = useDREData(filters);

  const isContabil = filters.viewMode === "contabil";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">DRE por Competência</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isContabil
              ? "Estrutura contábil padrão — Receita Bruta até Resultado Líquido"
              : "Regime de competência — todas as transações do período"}
          </p>
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
              <Info className="h-3.5 w-3.5" />
              Como funciona?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed max-w-lg">
              {isContabil ? (
                <>
                  O <strong>DRE Contábil</strong> segue a estrutura padrão da Demonstração do Resultado do Exercício: Receita Operacional → Deduções → Receita Líquida → CMV/CSP → Lucro Bruto → Despesas → Resultado Líquido. As categorias são classificadas automaticamente por palavras-chave. Use a <strong>Análise Vertical (AV %)</strong> para ver o percentual de cada linha em relação à Receita Operacional.
                </>
              ) : (
                <>
                  O <strong>DRE Gerencial</strong> utiliza o <strong>regime de competência</strong>: considera <strong>todas as transações</strong> do período (pagas ou pendentes), agrupadas pela <strong>data de competência</strong>. Isso mostra o resultado econômico real, independente de quando o pagamento foi efetivamente realizado.
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DREPeriodFilter
          filters={filters}
          onChange={(partial) => setFilters((prev) => ({ ...prev, ...partial }))}
          bankAccounts={bankAccounts}
          showVerticalAnalysis={showVerticalAnalysis}
          onToggleVerticalAnalysis={setShowVerticalAnalysis}
        />
      </div>

      {/* Indicator cards (contábil mode) */}
      {isContabil && !data.loading && (
        <DREIndicatorCards
          receitaOperacional={data.indicators.receitaOperacional}
          lucroBruto={data.indicators.lucroBruto}
          lucroLiquido={data.indicators.lucroLiquido}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isContabil ? "Demonstrativo de Resultado do Exercício" : "Demonstrativo de Resultado por Categoria"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isContabil ? (
            <DRETableContabil
              periods={data.periods}
              sections={data.sections}
              loading={data.loading}
              showVerticalAnalysis={showVerticalAnalysis}
            />
          ) : (
            <DRETable
              periods={data.periods}
              revenueRows={data.revenueRows}
              expenseRows={data.expenseRows}
              monthlyRevenueTotals={data.monthlyRevenueTotals}
              monthlyExpenseTotals={data.monthlyExpenseTotals}
              monthlyResults={data.monthlyResults}
              loading={data.loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

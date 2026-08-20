import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DREPeriodFilter } from "@/components/relatorios/DREPeriodFilter";
import { DRETable } from "@/components/relatorios/DRETable";
import { DRETableContabil } from "@/components/relatorios/DRETableContabil";
import { DREIndicatorCards } from "@/components/relatorios/DREIndicatorCards";
import {
  ExportReportButton,
  buildContabilRows,
  buildGerencialRows,
} from "@/components/relatorios/ExportReportButton";
import { useDREData, type DREFilters } from "@/hooks/useDREData";
import { useAccounts } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";


export default function DRE() {
  const { viewAll, personalSelected, selectedCompanyIds } = useCompany();
  const onlyPersonal = !viewAll && personalSelected && selectedCompanyIds.length === 0;
  const [filters, setFilters] = useState<DREFilters>({
    year: new Date().getFullYear(),
    granularity: "monthly",
    viewMode: "contabil",
  });
  const [showVerticalAnalysis, setShowVerticalAnalysis] = useState(false);
  const [showHorizontalAnalysis, setShowHorizontalAnalysis] = useState(false);
  const { bankAccounts } = useAccounts();
  const data = useDREData(filters);

  if (onlyPersonal) return <Navigate to="/dashboard" replace />;

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
                  O <strong>DRE Contábil</strong> segue a estrutura padrão da Demonstração do Resultado do Exercício e usa os <strong>Centros de Custo</strong> como única fonte de classificação. Cada categoria precisa estar vinculada a um centro (Receita Operacional, CMV, Despesas Operacionais, etc.) na página <Link to="/centros-de-custos" className="text-primary hover:underline">Centros de Custos</Link>. Categorias sem vínculo não aparecem no DRE.
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
          showHorizontalAnalysis={showHorizontalAnalysis}
          onToggleHorizontalAnalysis={setShowHorizontalAnalysis}
        />
      </div>

      {/* Unmapped categories warning (contábil) */}
      {isContabil && !data.loading && data.unmappedCategoryCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              {data.unmappedCategoryCount} categoria{data.unmappedCategoryCount === 1 ? "" : "s"} sem centro de custo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lançamentos dessas categorias não aparecem no DRE. Vincule-as em{" "}
              <Link to="/centros-de-custos" className="text-primary hover:underline font-medium">
                Centros de Custos
              </Link>{" "}
              para refletirem corretamente no DRE.
            </p>
          </div>
        </div>
      )}

      {/* Indicator cards (contábil mode) */}
      {isContabil && !data.loading && (
        <DREIndicatorCards
          receitaLiquida={data.indicators.receitaLiquida}
          lucroBruto={data.indicators.lucroBruto}
          ebitda={data.indicators.ebitda}
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
              showHorizontalAnalysis={showHorizontalAnalysis}
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

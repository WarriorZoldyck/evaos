import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Procedure, CostSummary } from "@/hooks/usePricing";

interface CostBreakdownCardProps {
  procedure: Procedure;
  costSummary: CostSummary;
  profitMargin: number;
  calcPrice: (proc: Procedure) => {
    custoFixoProporcional: number;
    custosVariaveis: number;
    subtotal: number;
    margemValor: number;
    precoSugerido: number;
  };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CostBreakdownCard({ procedure, costSummary, profitMargin, calcPrice }: CostBreakdownCardProps) {
  const calc = calcPrice(procedure);
  const belowCost = procedure.desired_price > 0 && procedure.desired_price < calc.subtotal;
  const belowSuggested = procedure.desired_price > 0 && procedure.desired_price < calc.precoSugerido && !belowCost;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Decomposição — {procedure.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo/Hora Clínica</span>
            <span>{fmt(costSummary.custoHora)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tempo de execução</span>
            <span>{procedure.execution_time}h</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Custo fixo proporcional</span>
            <span>{fmt(calc.custoFixoProporcional)}</span>
          </div>

          <Separator />

          {procedure.items.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground font-medium">Custos variáveis:</p>
              {procedure.items.map((item) => (
                <div key={item.id} className="flex justify-between pl-3 text-xs">
                  <span>{item.description}</span>
                  <span>{fmt(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium">
                <span>Total custos variáveis</span>
                <span>{fmt(calc.custosVariaveis)}</span>
              </div>
              <Separator />
            </>
          )}

          <div className="flex justify-between font-medium">
            <span>Subtotal (custo real)</span>
            <span>{fmt(calc.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margem de lucro ({profitMargin}%)</span>
            <span>+ {fmt(calc.margemValor)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-bold text-primary">
            <span>Preço Sugerido</span>
            <span>{fmt(calc.precoSugerido)}</span>
          </div>

          {procedure.desired_price > 0 && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-medium">Preço Desejado</span>
                <span className="font-bold">{fmt(procedure.desired_price)}</span>
              </div>

              {belowCost && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>O preço desejado está <strong>abaixo do custo real</strong> ({fmt(calc.subtotal)}). Você terá prejuízo neste procedimento.</span>
                </div>
              )}
              {belowSuggested && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>O preço desejado está abaixo do sugerido. A margem efetiva será menor que {profitMargin}%.</span>
                </div>
              )}
              {!belowCost && !belowSuggested && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>O preço desejado está acima do sugerido. Margem saudável!</span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

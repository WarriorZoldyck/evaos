import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BarChart3 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedure: ProcedureV2;
  custoHora: number;
  taxRate: number;
  calcProcedure: (proc: ProcedureV2) => { cf: number; cv: number; nf: number; liquido: number; lucro: number; lucratividadeHora: number; lucratividadePct: number; lucratividadeHoraTotal: number };
}

export function ProcedureBreakdownV2({ procedure, custoHora, taxRate, calcProcedure }: Props) {
  const calc = calcProcedure(procedure);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Decomposição — {procedure.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Custo Fixo (CF) = {procedure.execution_time}h × {fmt(custoHora)}/h</span>
          <span className="font-medium">{fmt(calc.cf)}</span>
        </div>

        {procedure.items.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Custos Variáveis (CV):</span>
            {procedure.items.map((item) => (
              <div key={item.id} className="flex justify-between pl-4">
                <span className="text-muted-foreground">{item.description}</span>
                <span>{fmt(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between pl-4 font-medium">
              <span>Subtotal CV</span>
              <span>{fmt(calc.cv)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">NF (Imposto) = {taxRate}% × {fmt(procedure.desired_price)}</span>
          <span className="font-medium">{fmt(calc.nf)}</span>
        </div>

        <Separator />

        <div className="flex justify-between">
          <span className="text-muted-foreground">Líquido (Preço − NF)</span>
          <span className="font-medium">{fmt(calc.liquido)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor Cobrado</span>
          <span className="font-bold">{fmt(procedure.desired_price)}</span>
        </div>

        <div className={`flex justify-between text-base font-bold ${calc.lucro < 0 ? "text-destructive" : "text-emerald-600"}`}>
          <span>Lucro</span>
          <span>{fmt(calc.lucro)}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Lucratividade / hora</p>
            <p className={`text-lg font-bold ${calc.lucro < 0 ? "text-destructive" : ""}`}>{fmt(calc.lucratividadeHora)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Lucratividade %</p>
            <p className={`text-lg font-bold ${calc.lucro < 0 ? "text-destructive" : ""}`}>{calc.lucratividadePct.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Lucr./h total</p>
            <p className="text-lg font-bold">{fmt(calc.lucratividadeHoraTotal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { BarChart3 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedure: ProcedureV2;
  custoHora: number;
  taxRate: number;
  calcProcedure: (proc: ProcedureV2) => { cf: number; cv: number; nf: number; liquido: number; lucro: number; lucratividadeHora: number; lucratividadePct: number; lucratividadeHoraTotal: number };
  onUpdatePrice?: (id: string, price: number) => Promise<boolean>;
  onUpdateTime?: (id: string, time: number) => Promise<boolean>;
}

export function ProcedureBreakdownV2({ procedure, custoHora, taxRate, calcProcedure, onUpdatePrice, onUpdateTime }: Props) {
  const [localPrice, setLocalPrice] = useState<number | null>(null);
  const [localTime, setLocalTime] = useState<number | null>(null);

  const effectivePrice = localPrice ?? procedure.desired_price;
  const effectiveTime = localTime ?? procedure.execution_time;

  // Build a temporary procedure with local overrides for real-time calc
  const liveProcedure = useMemo(() => ({
    ...procedure,
    desired_price: effectivePrice,
    execution_time: effectiveTime,
  }), [procedure, effectivePrice, effectiveTime]);

  const calc = calcProcedure(liveProcedure);

  const handlePriceChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setLocalPrice(num);
      onUpdatePrice?.(procedure.id, num);
    }
  };

  const handleTimeChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setLocalTime(num);
      onUpdateTime?.(procedure.id, num);
    }
  };

  // Reset local overrides when procedure changes from parent
  const [prevId, setPrevId] = useState(procedure.id);
  if (procedure.id !== prevId) {
    setPrevId(procedure.id);
    setLocalPrice(null);
    setLocalTime(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Decomposição — {procedure.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Valor Cobrado */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Valor Cobrado</span>
          {onUpdatePrice ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="w-28 h-7 text-right text-sm font-bold"
                value={effectivePrice}
                onChange={(e) => handlePriceChange(e.target.value)}
              />
            </div>
          ) : (
            <span className="font-bold">{fmt(procedure.desired_price)}</span>
          )}
        </div>

        {/* Tempo */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Tempo de Execução</span>
          {onUpdateTime ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                step={0.5}
                className="w-28 h-7 text-right text-sm font-bold"
                value={effectiveTime}
                onChange={(e) => handleTimeChange(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">h</span>
            </div>
          ) : (
            <span className="font-medium">{procedure.execution_time}h</span>
          )}
        </div>

        <Separator />

        {/* Deduções */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">(-) Custo Fixo (CF) = {effectiveTime}h × {fmt(custoHora)}/h</span>
          <span className="font-medium text-destructive">-{fmt(calc.cf)}</span>
        </div>

        {procedure.items.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">(-) Custos Variáveis (CV):</span>
            {procedure.items.map((item) => (
              <div key={item.id} className="flex justify-between pl-4">
                <span className="text-muted-foreground">{item.description}</span>
                <span className="text-destructive">-{fmt(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between pl-4 font-medium">
              <span>Subtotal CV</span>
              <span className="text-destructive">-{fmt(calc.cv)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">(-) NF (Imposto) = {taxRate}% × {fmt(effectivePrice)}</span>
          <span className="font-medium text-destructive">-{fmt(calc.nf)}</span>
        </div>

        <Separator />

        {/* Líquido */}
        <div className={`flex justify-between text-base font-bold ${calc.liquido < 0 ? "text-destructive" : "text-emerald-600"}`}>
          <span>Líquido (Preço − CF − CV − NF)</span>
          <span>{fmt(calc.liquido)}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Lucratividade / hora</p>
            <p className={`text-lg font-bold ${calc.liquido < 0 ? "text-destructive" : ""}`}>{fmt(calc.lucratividadeHora)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Lucratividade %</p>
            <p className={`text-lg font-bold ${calc.liquido < 0 ? "text-destructive" : ""}`}>{calc.lucratividadePct.toFixed(1)}%</p>
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

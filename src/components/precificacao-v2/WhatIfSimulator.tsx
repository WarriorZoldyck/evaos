import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, RotateCcw } from "lucide-react";
import type { ProcedureV2, CostGroupTotals } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedures: ProcedureV2[];
  groupTotals: CostGroupTotals;
  realHours: number;
  realRooms: number;
  realTaxRate: number;
}

export function WhatIfSimulator({ procedures, groupTotals, realHours, realRooms, realTaxRate }: Props) {
  const [simHours, setSimHours] = useState(String(realHours));
  const [simRooms, setSimRooms] = useState(String(realRooms));
  const [simTax, setSimTax] = useState(String(realTaxRate));

  const hoursNum = parseInt(simHours) || realHours;
  const roomsNum = parseFloat(simRooms) || realRooms;
  const taxNum = parseFloat(simTax) || realTaxRate;

  const simCustoHora = hoursNum > 0 ? groupTotals.total / hoursNum : 0;
  const realCustoHora = realHours > 0 ? groupTotals.total / realHours : 0;

  const changed = hoursNum !== realHours || roomsNum !== realRooms || taxNum !== realTaxRate;

  const reset = () => {
    setSimHours(String(realHours));
    setSimRooms(String(realRooms));
    setSimTax(String(realTaxRate));
  };

  const calcSim = (proc: ProcedureV2) => {
    const cf = simCustoHora * proc.execution_time;
    const cv = proc.items.reduce((s, i) => s + i.value, 0);
    const nf = proc.desired_price * (taxNum / 100);
    const lucro = proc.desired_price - cf - cv - nf;
    const lucroHora = proc.execution_time > 0 ? lucro / proc.execution_time : 0;
    const lucroPct = proc.desired_price > 0 ? (lucro / proc.desired_price) * 100 : 0;
    return { cf, cv, nf, lucro, lucroHora, lucroPct };
  };

  const calcReal = (proc: ProcedureV2) => {
    const cf = realCustoHora * proc.execution_time;
    const cv = proc.items.reduce((s, i) => s + i.value, 0);
    const nf = proc.desired_price * (realTaxRate / 100);
    const lucro = proc.desired_price - cf - cv - nf;
    return { lucro };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Simulador "E se?"
            {changed && <Badge variant="secondary" className="text-[10px]">Simulando</Badge>}
          </CardTitle>
          {changed && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs">
              <RotateCcw className="h-3 w-3" /> Resetar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Ajuste os parâmetros abaixo para ver o impacto em tempo real na lucratividade — sem alterar os dados salvos.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Horas / mês</Label>
            <Input type="number" min={1} value={simHours} onChange={(e) => setSimHours(e.target.value)} />
            {hoursNum !== realHours && (
              <p className="text-[10px] text-muted-foreground">Atual: {realHours}h</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Salas</Label>
            <Input type="number" min={0.1} step={0.01} value={simRooms} onChange={(e) => setSimRooms(e.target.value)} />
            {roomsNum !== realRooms && (
              <p className="text-[10px] text-muted-foreground">Atual: {realRooms}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Alíquota IR (%)</Label>
            <Input type="number" min={0} step={0.01} value={simTax} onChange={(e) => setSimTax(e.target.value)} />
            {taxNum !== realTaxRate && (
              <p className="text-[10px] text-muted-foreground">Atual: {realTaxRate}%</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Custo / Hora simulado</span>
          <div className="flex items-center gap-2">
            {changed && (
              <span className="text-xs text-muted-foreground line-through">{fmt(realCustoHora)}</span>
            )}
            <span className="text-lg font-bold">{fmt(simCustoHora)}</span>
          </div>
        </div>

        <Separator />

        {procedures.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Impacto nos procedimentos</p>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-1 pr-2">Procedimento</th>
                    <th className="text-right py-1 px-2">Lucro Atual</th>
                    <th className="text-right py-1 px-2">Lucro Simulado</th>
                    <th className="text-right py-1 pl-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((proc) => {
                    const sim = calcSim(proc);
                    const real = calcReal(proc);
                    const delta = sim.lucro - real.lucro;
                    return (
                      <tr key={proc.id} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 font-medium">{proc.name}</td>
                        <td className="py-1.5 px-2 text-right">{fmt(real.lucro)}</td>
                        <td className={`py-1.5 px-2 text-right font-bold ${sim.lucro < 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {fmt(sim.lucro)}
                        </td>
                        <td className={`py-1.5 pl-2 text-right text-xs ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-destructive" : ""}`}>
                          {delta > 0 ? "+" : ""}{fmt(delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            Cadastre procedimentos para ver o impacto da simulação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

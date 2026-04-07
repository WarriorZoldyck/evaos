import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Target } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  custoHora: number;
  taxRate: number;
}

export function SuggestedPriceCalculator({ custoHora, taxRate }: Props) {
  const [time, setTime] = useState("1");
  const [cv, setCv] = useState("0");
  const [margin, setMargin] = useState("30");

  const timeNum = parseFloat(time) || 0;
  const cvNum = parseFloat(cv) || 0;
  const marginNum = parseFloat(margin) || 0;

  const cf = custoHora * timeNum;
  const totalCost = cf + cvNum;

  // Price = totalCost / (1 - margin/100 - taxRate/100)
  const divisor = 1 - marginNum / 100 - taxRate / 100;
  const suggestedPrice = divisor > 0 ? totalCost / divisor : 0;
  const nf = suggestedPrice * (taxRate / 100);
  const profit = suggestedPrice - cf - cvNum - nf;
  const profitPerHour = timeNum > 0 ? profit / timeNum : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Calculadora de Preço Sugerido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Informe o tempo, custos variáveis e a margem de lucro desejada. O sistema calcula o preço ideal.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tempo (horas)</Label>
            <Input type="number" min={0.25} step={0.25} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Custos Variáveis (R$)</Label>
            <Input type="number" min={0} step={0.01} value={cv} onChange={(e) => setCv(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margem desejada (%)</Label>
            <Input type="number" min={0} max={99} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">CF ({timeNum}h × {fmt(custoHora)}/h)</span>
            <span>{fmt(cf)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CV (materiais)</span>
            <span>{fmt(cvNum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">NF ({taxRate}%)</span>
            <span>{fmt(nf)}</span>
          </div>
          <Separator />
          {divisor <= 0 ? (
            <p className="text-destructive text-center font-medium">
              Margem + Alíquota ≥ 100% — impossível calcular
            </p>
          ) : (
            <>
              <div className="flex justify-between text-lg font-bold text-primary">
                <span>💰 Preço Sugerido</span>
                <span>{fmt(suggestedPrice)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Lucro ({marginNum.toFixed(1)}%)</span>
                <span>{fmt(profit)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Lucro / hora</span>
                <span>{fmt(profitPerHour)}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

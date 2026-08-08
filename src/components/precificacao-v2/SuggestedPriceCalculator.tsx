import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  custoHora: number;
  taxRate: number;
  procedures?: ProcedureV2[];
}

export function SuggestedPriceCalculator({ custoHora, taxRate, procedures = [] }: Props) {
  const [time, setTime] = useState("1");
  const [margin, setMargin] = useState("30");
  const [qty, setQty] = useState("1");
  const [baseId, setBaseId] = useState<string>("");

  const timeNum = parseFloat(time) || 0;
  const marginNum = parseFloat(margin) || 0;
  const qtyNum = Math.max(1, Math.round(parseFloat(qty) || 1));

  // Calculated defaults
  const defaultCf = custoHora * timeNum;
  const defaultCv = 0;

  // Override states (null = use calculated)
  const [cfOverride, setCfOverride] = useState<string | null>(null);
  const [cvOverride, setCvOverride] = useState<string | null>(null);
  const [nfRateOverride, setNfRateOverride] = useState<string | null>(null);

  // Actual values
  const cf = cfOverride !== null ? (parseFloat(cfOverride) || 0) : defaultCf;
  const cvNum = cvOverride !== null ? (parseFloat(cvOverride) || 0) : defaultCv;
  const effectiveTaxRate = nfRateOverride !== null ? (parseFloat(nfRateOverride) || 0) : taxRate;

  const totalCost = cf + cvNum;
  const divisor = 1 - marginNum / 100 - effectiveTaxRate / 100;
  const suggestedPrice = divisor > 0 ? totalCost / divisor : 0;
  const nf = suggestedPrice * (effectiveTaxRate / 100);
  const profit = suggestedPrice - cf - cvNum - nf;
  const profitPerHour = timeNum > 0 ? profit / timeNum : 0;

  const hasOverride = cfOverride !== null || cvOverride !== null || nfRateOverride !== null;

  const resetOverrides = () => {
    setCfOverride(null);
    setCvOverride(null);
    setNfRateOverride(null);
  };

  // Reset CF override when time changes so it recalculates
  useEffect(() => {
    if (cfOverride !== null) setCfOverride(null);
  }, [time, custoHora]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Calculadora de Preço Sugerido
          </CardTitle>
          {hasOverride && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={resetOverrides}>
              <RotateCcw className="h-3 w-3" /> Resetar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Informe o tempo e a margem desejada. Clique nos valores abaixo para simular cenários diferentes.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tempo (horas)</Label>
            <Input type="number" min={0.25} step={0.25} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margem desejada (%)</Label>
            <Input type="number" min={0} max={99} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">CF ({timeNum}h × {fmt(custoHora)}/h)</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="w-32 h-7 text-right text-sm"
              value={cfOverride !== null ? cfOverride : cf.toFixed(2)}
              onChange={(e) => setCfOverride(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">CV (materiais)</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="w-32 h-7 text-right text-sm"
              value={cvOverride !== null ? cvOverride : cvNum.toFixed(2)}
              onChange={(e) => setCvOverride(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">NF (alíquota %)</span>
            <Input
              type="number"
              min={0}
              max={99}
              step={0.1}
              className="w-32 h-7 text-right text-sm"
              value={nfRateOverride !== null ? nfRateOverride : effectiveTaxRate.toFixed(1)}
              onChange={(e) => setNfRateOverride(e.target.value)}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Imposto calculado</span>
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
                <span>Preço Sugerido</span>
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

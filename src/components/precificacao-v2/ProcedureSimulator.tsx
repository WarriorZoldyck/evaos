import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Check, X } from "lucide-react";
import type { ProcedureV2, ItemUnitType } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedure: ProcedureV2;
  taxRate: number;
  calcParts: (i: { execution_time: number; quantity: number; items: { value: number; unit_type: ItemUnitType }[] }) => { qty: number; cf: number; cv: number };
  calcFrom: (i: { execution_time: number; quantity: number; desired_price: number; items: { value: number; unit_type: ItemUnitType }[] }) => { qty: number; cf: number; cv: number; nf: number; liquido: number; lucro: number; lucratividadeHora: number; lucratividadePct: number };
  suggestPrice: (parts: { cf: number; cv: number }, targetMarginPct: number) => number | null;
  onApplyPrice: (price: number) => void;
}

export function ProcedureSimulator({ procedure, taxRate, calcParts, calcFrom, suggestPrice, onApplyPrice }: Props) {
  const [qty, setQty] = useState(String(procedure.quantity ?? 1));
  const [time, setTime] = useState(String(procedure.execution_time));
  const [margin, setMargin] = useState("30");
  const [price, setPrice] = useState(String(procedure.desired_price));
  const [minMargin, setMinMargin] = useState("15");

  // Resync when another procedure is selected
  useEffect(() => {
    setQty(String(procedure.quantity ?? 1));
    setTime(String(procedure.execution_time));
    setPrice(String(procedure.desired_price));
  }, [procedure.id]);

  const qtyNum = Math.max(1, Math.round(parseFloat(qty.replace(",", ".")) || 1));
  const timeNum = parseFloat(time.replace(",", ".")) || 0;
  const marginNum = parseFloat(margin.replace(",", ".")) || 0;
  const priceNum = parseFloat(price.replace(",", ".")) || 0;
  const minMarginNum = parseFloat(minMargin.replace(",", ".")) || 0;

  const base = { execution_time: timeNum, quantity: qtyNum, items: procedure.items };
  const parts = calcParts(base);

  const suggested = suggestPrice(parts, marginNum);
  const minViable = suggestPrice(parts, minMarginNum);
  const scenario = calcFrom({ ...base, desired_price: priceNum });
  const canDo = minViable !== null && priceNum >= minViable;

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex justify-between ${strong ? "text-lg font-bold text-primary" : "text-sm text-muted-foreground"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const inputs = (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Quantidade</Label>
        <Input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tempo (horas)</Label>
        <Input type="number" min={0} step={0.25} value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
    </div>
  );

  const costsInfo = (
    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
      <Row label={`Custo fixo (${timeNum}h)`} value={fmt(parts.cf)} />
      <Row label={`Custos variáveis (qtd ${qtyNum})`} value={fmt(parts.cv)} />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Simulador — {procedure.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preco">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="preco">Quanto cobrar?</TabsTrigger>
            <TabsTrigger value="lucro">Quanto lucro tenho?</TabsTrigger>
            <TabsTrigger value="posso">Posso fazer por X?</TabsTrigger>
          </TabsList>

          {/* Modo 1 */}
          <TabsContent value="preco" className="space-y-3 pt-4">
            {inputs}
            <div className="space-y-1.5">
              <Label className="text-xs">Lucratividade desejada (%)</Label>
              <Input type="number" min={0} max={99} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
            {costsInfo}
            <Separator />
            {suggested === null ? (
              <p className="text-destructive text-sm text-center font-medium">
                Lucratividade + alíquota ({taxRate}%) ≥ 100% — cenário impossível.
              </p>
            ) : (
              <div className="space-y-1">
                <Row label="Preço total sugerido" value={fmt(suggested)} strong />
                <Row label={`Preço por unidade (${qtyNum}×)`} value={fmt(suggested / qtyNum)} />
                <Button size="sm" className="w-full mt-2" onClick={() => onApplyPrice(Number(suggested.toFixed(2)))}>
                  Aplicar ao procedimento
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Modo 2 */}
          <TabsContent value="lucro" className="space-y-3 pt-4">
            {inputs}
            <div className="space-y-1.5">
              <Label className="text-xs">Preço proposto (total)</Label>
              <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            {costsInfo}
            <Separator />
            <div className="space-y-1">
              <Row label="Preço por unidade" value={fmt(qtyNum > 0 ? priceNum / qtyNum : 0)} />
              <Row label="Imposto (NF)" value={fmt(scenario.nf)} />
              <div className={`flex justify-between text-lg font-bold ${scenario.lucro < 0 ? "text-destructive" : "text-emerald-600"}`}>
                <span>Lucro</span>
                <span>{fmt(scenario.lucro)} ({scenario.lucratividadePct.toFixed(1)}%)</span>
              </div>
              <Row label="Lucro / hora" value={fmt(scenario.lucratividadeHora)} />
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onApplyPrice(Number(priceNum.toFixed(2)))}>
                Aplicar ao procedimento
              </Button>
            </div>
          </TabsContent>

          {/* Modo 3 */}
          <TabsContent value="posso" className="space-y-3 pt-4">
            {inputs}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Preço-alvo (total)</Label>
                <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lucratividade mínima (%)</Label>
                <Input type="number" min={0} max={99} step={0.5} value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
              </div>
            </div>
            {costsInfo}
            <Separator />
            {minViable === null ? (
              <p className="text-destructive text-sm text-center font-medium">
                Lucratividade mínima + alíquota ({taxRate}%) ≥ 100% — cenário impossível.
              </p>
            ) : (
              <div className="space-y-1">
                <div className={`flex items-center justify-center gap-2 text-lg font-bold ${canDo ? "text-emerald-600" : "text-destructive"}`}>
                  {canDo ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  {canDo ? "Sim, pode fazer" : "Não compensa"}
                </div>
                <Row label="Preço mínimo viável (total)" value={fmt(minViable)} />
                <Row label="Preço mínimo por unidade" value={fmt(minViable / qtyNum)} />
                <Row label="Lucratividade no preço-alvo" value={`${scenario.lucratividadePct.toFixed(1)}%`} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

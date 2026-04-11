import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { BarChart3 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function InlineValue({ value, onSave, label }: { value: number; onSave: (v: number) => void; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setEditValue(String(value));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num >= 0) onSave(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={0}
        step={0.01}
        className="w-28 h-7 text-right text-sm"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-text hover:bg-muted/50 rounded px-1 py-0.5 transition-colors font-bold"
      onDoubleClick={() => setEditing(true)}
      title="Duplo clique para editar"
    >
      {fmt(value)}
    </span>
  );
}

interface Props {
  procedure: ProcedureV2;
  custoHora: number;
  taxRate: number;
  calcProcedure: (proc: ProcedureV2) => { cf: number; cv: number; nf: number; liquido: number; lucro: number; lucratividadeHora: number; lucratividadePct: number; lucratividadeHoraTotal: number };
  onUpdatePrice?: (id: string, price: number) => Promise<boolean>;
  onUpdateTime?: (id: string, time: number) => Promise<boolean>;
}

export function ProcedureBreakdownV2({ procedure, custoHora, taxRate, calcProcedure, onUpdatePrice, onUpdateTime }: Props) {
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
        {/* Valor Cobrado — editável */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Valor Cobrado</span>
          {onUpdatePrice ? (
            <InlineValue value={procedure.desired_price} onSave={(v) => onUpdatePrice(procedure.id, v)} />
          ) : (
            <span className="font-bold">{fmt(procedure.desired_price)}</span>
          )}
        </div>

        {/* Tempo — editável */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Tempo de Execução</span>
          {onUpdateTime ? (
            <InlineValue value={procedure.execution_time} onSave={(v) => onUpdateTime(procedure.id, v)} />
          ) : (
            <span className="font-medium">{procedure.execution_time}h</span>
          )}
        </div>

        <Separator />

        {/* Deduções */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">(-) Custo Fixo (CF) = {procedure.execution_time}h × {fmt(custoHora)}/h</span>
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
          <span className="text-muted-foreground">(-) NF (Imposto) = {taxRate}% × {fmt(procedure.desired_price)}</span>
          <span className="font-medium text-destructive">-{fmt(calc.nf)}</span>
        </div>

        <Separator />

        {/* Líquido = Preço - CF - CV - NF */}
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

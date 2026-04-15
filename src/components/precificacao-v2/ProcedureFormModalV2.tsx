import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedure: ProcedureV2 | null;
  custoHora: number;
  taxRate: number;
  onSave: (data: {
    name: string;
    execution_time: number;
    desired_price: number;
    items: { description: string; value: number }[];
  }) => Promise<boolean>;
}

interface ItemRow { description: string; value: string }

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProcedureFormModalV2({ open, onOpenChange, procedure, custoHora, taxRate, onSave }: Props) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("1");
  const [desiredPrice, setDesiredPrice] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (procedure) {
      setName(procedure.name);
      setTime(String(procedure.execution_time));
      setDesiredPrice(procedure.desired_price > 0 ? String(procedure.desired_price) : "");
      setItems(procedure.items.map((i) => ({ description: i.description, value: String(i.value) })));
    } else {
      setName(""); setTime("1"); setDesiredPrice(""); setItems([]);
    }
  }, [procedure, open]);

  const addItem = () => setItems([...items, { description: "", value: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemRow, val: string) => {
    const u = [...items]; u[idx] = { ...u[idx], [field]: val }; setItems(u);
  };

  const timeNum = parseFloat(String(time).replace(",", ".")) || 0;
  const priceNum = parseFloat(String(desiredPrice).replace(",", ".")) || 0;
  const cf = custoHora * timeNum;
  const cv = items.reduce((s, i) => s + (parseFloat(String(i.value).replace(",", ".")) || 0), 0);
  const nf = priceNum * (taxRate / 100);
  const lucro = priceNum - cf - cv - nf;
  const lucratividadePct = priceNum > 0 ? (lucro / priceNum) * 100 : 0;
  const isNegative = lucro < 0;

  const handleSave = async () => {
    if (!name.trim() || timeNum <= 0) return;
    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      execution_time: timeNum,
      desired_price: priceNum,
      items: items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), value: parseFloat(i.value) || 0 })),
    });
    setSaving(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{procedure ? "Editar Procedimento" : "Novo Procedimento"}</DialogTitle>
          <DialogDescription>Preencha os dados e veja o cálculo de lucratividade em tempo real.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="v2-proc-name">Nome *</Label>
            <Input id="v2-proc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Restauração em resina" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="v2-proc-time">Tempo (horas) *</Label>
              <Input id="v2-proc-time" type="number" min={0.25} step={0.25} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v2-proc-price">Valor cobrado (R$) *</Label>
              <Input id="v2-proc-price" type="number" min={0} step={0.01} value={desiredPrice} onChange={(e) => setDesiredPrice(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Custos Variáveis (materiais)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {items.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum item adicionado.</p>}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input placeholder="Descrição" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="flex-1" />
                  <Input type="number" min={0} step={0.01} placeholder="R$" value={item.value} onChange={(e) => updateItem(idx, "value", e.target.value)} className="w-28" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Calculation preview */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CF ({timeNum}h × {fmt(custoHora)}/h)</span>
              <span>{fmt(cf)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CV (materiais)</span>
              <span>{fmt(cv)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">NF ({taxRate}% s/ {fmt(priceNum)})</span>
              <span>{fmt(nf)}</span>
            </div>
            <Separator />
            <div className={`flex justify-between text-base font-bold ${isNegative ? "text-destructive" : "text-emerald-600"}`}>
              <span>Lucro</span>
              <span>{fmt(lucro)} {isNegative && "⚠"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lucratividade %</span>
              <span className={isNegative ? "text-destructive" : ""}>{lucratividadePct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || timeNum <= 0}>
            {saving ? "Salvando..." : procedure ? "Atualizar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

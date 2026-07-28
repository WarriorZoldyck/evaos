import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Goal } from "@/hooks/useGoals";
import { useMetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { ActionPlanDialog } from "./ActionPlanDialog";

interface GoalFormModalProps {
  open: boolean;
  onClose: () => void;
  editGoal: Goal | null;
  onSave: (data: any) => Promise<boolean>;
  onUpdate: (id: string, data: any) => Promise<boolean>;
}

export function GoalFormModal({ open, onClose, editGoal, onSave, onUpdate }: GoalFormModalProps) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [autoReserve, setAutoReserve] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [reserveAmount, setReserveAmount] = useState("");
  const [perExpense, setPerExpense] = useState("");
  const [perSale, setPerSale] = useState("");
  const [saving, setSaving] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const stats = useMetasSidebarStats();

  useEffect(() => {
    if (editGoal) {
      setName(editGoal.name);
      setTargetAmount(String(editGoal.target_amount));
      setDeadline(editGoal.deadline || "");
      setAutoReserve(editGoal.auto_reserve_enabled);
      setFrequency(editGoal.auto_reserve_frequency || "monthly");
      setReserveAmount(String(editGoal.auto_reserve_amount || ""));
      setPerExpense(String(editGoal.auto_reserve_per_expense || ""));
      setPerSale(String(editGoal.auto_reserve_per_sale || ""));
    } else {
      setName(""); setTargetAmount(""); setDeadline("");
      setAutoReserve(false); setFrequency("monthly");
      setReserveAmount(""); setPerExpense(""); setPerSale("");
    }
  }, [editGoal, open]);

  const handleSubmit = async () => {
    if (!name.trim() || !targetAmount) return;
    const payload = {
      name: name.trim(),
      target_amount: Number(targetAmount),
      deadline: deadline || null,
      auto_reserve_enabled: autoReserve,
      auto_reserve_frequency: autoReserve ? frequency : null,
      auto_reserve_amount: Number(reserveAmount) || 0,
      auto_reserve_per_expense: Number(perExpense) || 0,
      auto_reserve_per_sale: Number(perSale) || 0,
    };

    // Se a nova meta empurra a sobra para negativo, mostra plano antes de salvar.
    const targetDelta = editGoal
      ? Number(targetAmount) - Number(editGoal.target_amount)
      : Number(targetAmount);
    const projectedLeftover = stats.leftover - targetDelta;
    if (!stats.loading && projectedLeftover < 0 && !planOpen) {
      setPendingPayload(payload);
      setPlanOpen(true);
      return;
    }

    await persist(payload);
  };

  const persist = async (payload: any) => {
    setSaving(true);
    const ok = editGoal
      ? await onUpdate(editGoal.id, payload)
      : await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const confirmDespiteDeficit = async () => {
    setPlanOpen(false);
    if (pendingPayload) {
      const p = pendingPayload;
      setPendingPayload(null);
      await persist(p);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editGoal ? "Configurar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da meta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva de emergência" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor da meta (R$)</Label>
              <Input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="10000" />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Label>Reserva automática</Label>
            <Switch checked={autoReserve} onCheckedChange={setAutoReserve} />
          </div>

          {autoReserve && (
            <div className="space-y-3 pl-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Frequência</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quinzenal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Valor fixo (R$)</Label>
                  <Input type="number" value={reserveAmount} onChange={(e) => setReserveAmount(e.target.value)} placeholder="100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Por gasto (R$)</Label>
                  <Input type="number" value={perExpense} onChange={(e) => setPerExpense(e.target.value)} placeholder="10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Por venda (R$)</Label>
                  <Input type="number" value={perSale} onChange={(e) => setPerSale(e.target.value)} placeholder="10" />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !targetAmount}>
            {saving ? "Salvando..." : editGoal ? "Salvar" : "Criar Meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

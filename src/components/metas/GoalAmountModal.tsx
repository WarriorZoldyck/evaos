import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Goal } from "@/hooks/useGoals";

interface GoalAmountModalProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  type: "reserve" | "withdraw";
  onConfirm: (goalId: string, amount: number, description?: string) => Promise<boolean>;
}

export function GoalAmountModal({ open, onClose, goal, type, onConfirm }: GoalAmountModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!goal || !amount || Number(amount) <= 0) return;
    setSaving(true);
    const ok = await onConfirm(goal.id, Number(amount), description || undefined);
    setSaving(false);
    if (ok) {
      setAmount(""); setDescription("");
      onClose();
    }
  };

  const isReserve = type === "reserve";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isReserve ? "Reservar Valor" : "Retirar Valor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isReserve ? "Reserva mensal" : "Emergência"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !amount || Number(amount) <= 0}
            variant={isReserve ? "default" : "destructive"}
          >
            {saving ? "Salvando..." : isReserve ? "Reservar" : "Retirar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { GOAL_TYPE_LABELS, GOAL_TYPE_ORDER } from "@/lib/allocation";

export interface GoalPrefill {
  name?: string;
  goal_type?: string;
  target_amount?: number;
  deadline?: string | null;
  auto_reserve_amount?: number;
}

interface GoalFormModalProps {
  open: boolean;
  onClose: () => void;
  editGoal: Goal | null;
  /** Valores iniciais para uma NOVA meta (ex.: vindos da simulação). */
  prefill?: GoalPrefill | null;
  onSave: (data: any) => Promise<boolean>;
  onUpdate: (id: string, data: any) => Promise<boolean>;
}

export function GoalFormModal({ open, onClose, editGoal, prefill, onSave, onUpdate }: GoalFormModalProps) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [autoReserve, setAutoReserve] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [reserveAmount, setReserveAmount] = useState("");
  const [perExpense, setPerExpense] = useState("");
  const [perSale, setPerSale] = useState("");
  const [goalType, setGoalType] = useState<string>("sonho");
  const [allocationMode, setAllocationMode] = useState<string>("fixed");
  const [allocationPercent, setAllocationPercent] = useState("");
  const [yearMode, setYearMode] = useState(false);
  const [months, setMonths] = useState("12");

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
      setGoalType(editGoal.goal_type || "sonho");
      setAllocationMode(editGoal.allocation_mode || "fixed");
      setAllocationPercent(String(editGoal.allocation_percent || ""));
    } else if (prefill) {
      setName(prefill.name || "");
      setTargetAmount(prefill.target_amount ? String(prefill.target_amount) : "");
      setDeadline(prefill.deadline || "");
      setAutoReserve(Boolean(prefill.auto_reserve_amount));
      setFrequency("monthly");
      setReserveAmount(prefill.auto_reserve_amount ? String(prefill.auto_reserve_amount) : "");
      setPerExpense(""); setPerSale("");
      setGoalType(prefill.goal_type || "sonho");
      setAllocationMode("fixed"); setAllocationPercent("");
    } else {
      setName(""); setTargetAmount(""); setDeadline("");
      setAutoReserve(false); setFrequency("monthly");
      setReserveAmount(""); setPerExpense(""); setPerSale("");
      setGoalType("sonho"); setAllocationMode("fixed"); setAllocationPercent("");
    }
  }, [editGoal, prefill, open]);

  /** Modo anual: total + meses => valor mensal (e prazo estimado). */
  const applyYearPlan = (total: string, monthsRaw: string) => {
    setTargetAmount(total);
    setMonths(monthsRaw);
    const m = Number(monthsRaw) || 0;
    const t = Number(total) || 0;
    if (m > 0 && t > 0) {
      setReserveAmount(String(Math.round((t / m) * 100) / 100));
      setAutoReserve(true);
      const d = new Date();
      d.setMonth(d.getMonth() + m);
      setDeadline(d.toISOString().slice(0, 10));
    }
  };


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
      goal_type: goalType,
      allocation_mode: allocationMode,
      allocation_percent: allocationMode === "percent" ? Number(allocationPercent) || 0 : 0,
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
          <div className="space-y-2">
            <Label>Tipo de objetivo</Label>
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor da meta (R$)</Label>
              <Input
                type="number"
                value={targetAmount}
                onChange={(e) => (yearMode ? applyYearPlan(e.target.value, months) : setTargetAmount(e.target.value))}
                placeholder="10000"
              />

            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Pensar no ano</Label>
                <p className="text-xs text-muted-foreground">
                  Informe o total e o prazo em meses; calculamos quanto guardar por mês.
                </p>
              </div>
              <Switch
                checked={yearMode}
                onCheckedChange={(v) => {
                  setYearMode(v);
                  if (v) applyYearPlan(targetAmount, months);
                }}
              />

            </div>

            {yearMode && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Prazo (meses)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={months}
                    onChange={(e) => applyYearPlan(targetAmount, e.target.value)}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Guardar por mês (R$)</Label>
                  <Input
                    type="number"
                    value={reserveAmount}
                    onChange={(e) => {
                      setReserveAmount(e.target.value);
                      const m = Number(months) || 0;
                      const perMonth = Number(e.target.value) || 0;
                      if (m > 0 && perMonth > 0) setTargetAmount(String(Math.round(perMonth * m * 100) / 100));
                    }}
                    placeholder="1000"
                  />
                </div>
              </div>
            )}
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
              <div className="space-y-2">
                <Label className="text-xs">Como alocar a sobra</Label>
                <Select value={allocationMode} onValueChange={setAllocationMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor fixo mensal</SelectItem>
                    <SelectItem value="percent">Percentual da sobra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {allocationMode === "percent" && (
                <div className="space-y-2">
                  <Label className="text-xs">Percentual da sobra (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={allocationPercent}
                    onChange={(e) => setAllocationPercent(e.target.value)}
                    placeholder="30"
                  />
                </div>
              )}

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
      <ActionPlanDialog
        open={planOpen}
        onClose={() => { setPlanOpen(false); setPendingPayload(null); }}
        gap={Math.max(0, (Number(targetAmount) || 0) - Math.max(0, stats.leftover))}
        topCategories={stats.topCategories}
        goalName={name}
        title="Essa meta não cabe na sobra"
      />
      {planOpen && pendingPayload && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
          <Button onClick={confirmDespiteDeficit} variant="destructive" className="shadow-lg">
            Criar mesmo assim
          </Button>
        </div>
      )}
    </Dialog>
  );
}

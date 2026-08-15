import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, TrendingUp, PiggyBank } from "lucide-react";
import { formatBRL } from "@/lib/goalPlanning";
import { deadlineFromMonths } from "@/lib/savingsSimulator";
import { cn } from "@/lib/utils";
import type { Goal } from "@/hooks/useGoals";
import {
  buildAllocationBudget,
  monthlyFromAllocation,
  targetFromMonthly,
  validateAllocation,
  GOAL_TYPE_LABELS,
  GOAL_TYPE_ORDER,
  type AllocationMode,
  type GoalType,
} from "@/lib/allocation";
import { GoalTypeIcon } from "./goalTypeIcon";

const PLAN_MONTHS = 12;

export interface ObjectiveDraft {
  name: string;
  goal_type: GoalType;
  target_amount: number;
  deadline: string | null;
  allocation_mode: AllocationMode;
  allocation_percent: number;
  auto_reserve_amount: number;
  auto_reserve_enabled: boolean;
}

const NAME_SUGGESTIONS: Record<GoalType, string> = {
  reserva: "Reserva de emergência",
  sonho: "Comprar um carro",
  investimento: "Aportes em investimentos",
  divida: "Quitar dívida",
  outro: "Novo objetivo",
};

/**
 * Camada 2: transforma a sobra simulada (metas orçamentárias)
 * em um Objetivo com alocação fixa ou percentual.
 */
export function CreateGoalFromSimulationDialog({
  open,
  onOpenChange,
  simulatedGain,
  simulatedSaving,
  baseCapacity,
  simulatedCapacity,
  baseLeftover,
  simulatedLeftover,
  goals,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulatedGain: number;
  simulatedSaving: number;
  baseCapacity: number;
  simulatedCapacity: number;
  baseLeftover: number;
  simulatedLeftover: number;
  goals: Goal[];
  onCreate: (draft: ObjectiveDraft) => Promise<boolean> | void;
}) {
  const [goalType, setGoalType] = useState<GoalType>("reserva");
  const [name, setName] = useState(NAME_SUGGESTIONS.reserva);
  const [mode, setMode] = useState<AllocationMode>("percent");
  const [percent, setPercent] = useState("30");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(String(PLAN_MONTHS));
  const [saving, setSaving] = useState(false);

  const budget = useMemo(
    () =>
      buildAllocationBudget(
        simulatedCapacity,
        goals.map((g) => ({
          mode: (g.allocation_mode === "percent" ? "percent" : "fixed") as AllocationMode,
          amount: g.auto_reserve_amount || 0,
          percent: g.allocation_percent || 0,
        })),
      ),
    [simulatedCapacity, goals],
  );

  useEffect(() => {
    if (!open) return;
    setGoalType("reserva");
    setName(NAME_SUGGESTIONS.reserva);
    setMode("percent");
    setPercent("30");
    setAmount(budget.free > 0 ? budget.free.toFixed(2) : "");
    setMonths(String(PLAN_MONTHS));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocation = useMemo(
    () => ({
      mode,
      percent: Number(percent.replace(",", ".")) || 0,
      amount: Number(amount.replace(",", ".")) || 0,
    }),
    [mode, percent, amount],
  );

  const monthly = monthlyFromAllocation(allocation, budget.total);
  const check = validateAllocation(allocation, budget);
  const monthsNum = Math.max(1, Math.round(Number(months) || PLAN_MONTHS));
  const target = targetFromMonthly(monthly, monthsNum);

  const pickType = (t: GoalType) => {
    setGoalType(t);
    setName((cur) => {
      const wasSuggestion = Object.values(NAME_SUGGESTIONS).includes(cur) || !cur.trim();
      return wasSuggestion ? NAME_SUGGESTIONS[t] : cur;
    });
  };

  const handleConfirm = async () => {
    if (!check.valid || !name.trim()) return;
    setSaving(true);
    await onCreate({
      name: name.trim(),
      goal_type: goalType,
      target_amount: target,
      deadline: deadlineFromMonths(monthsNum),
      allocation_mode: mode,
      allocation_percent: mode === "percent" ? allocation.percent : 0,
      auto_reserve_amount: monthly,
      auto_reserve_enabled: true,
    });
    setSaving(false);
    onOpenChange(false);
  };

  const delta = (a: number, b: number) => {
    const d = a - b;
    if (Math.abs(d) < 0.01) return null;
    return `${d > 0 ? "+" : "−"} ${formatBRL(Math.abs(d))}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Usar o que vai sobrar
          </DialogTitle>
          <DialogDescription>
            As metas orçamentárias definem quanto sobra. Aqui você decide o destino dessa sobra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox
              label="Nova capacidade mensal"
              value={simulatedCapacity}
              hint={delta(simulatedCapacity, baseCapacity)}
            />
            <StatBox
              label="Nova sobra até dez"
              value={simulatedLeftover}
              hint={delta(simulatedLeftover, baseLeftover)}
            />
          </div>

          <div className="rounded-xl border border-border/60 p-3 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">De onde vem esse valor</p>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Ganho extra simulado
              </span>
              <span className="font-mono text-foreground">{formatBRL(simulatedGain)}/mês</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <PiggyBank className="h-3.5 w-3.5" /> Economia simulada
              </span>
              <span className="font-mono text-foreground">{formatBRL(simulatedSaving)}/mês</span>
            </div>
          </div>

          {/* Quanto da sobra já está comprometido */}
          <div className="rounded-xl border border-border/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Sobra comprometida com objetivos</span>
              <span className="font-mono">
                {formatBRL(budget.committed)} de {formatBRL(budget.total)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  budget.overCommitted ? "bg-destructive" : "bg-primary/70",
                )}
                style={{ width: `${Math.min(100, budget.committedPercent)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Livre agora:{" "}
              <span className="font-mono text-foreground">{formatBRL(budget.free)}/mês</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">Tipo de objetivo</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {GOAL_TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                    goalType === t
                      ? "border-primary/50 bg-accent/40 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-accent/20",
                  )}
                >
                  <GoalTypeIcon type={t} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{GOAL_TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obj-name" className="text-[11px] text-muted-foreground">
              Nome do objetivo
            </Label>
            <Input
              id="obj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              placeholder="Ex: Comprar um carro"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">Como alocar a sobra</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <ModeButton
                active={mode === "percent"}
                onClick={() => setMode("percent")}
                label="Percentual da sobra"
              />
              <ModeButton
                active={mode === "fixed"}
                onClick={() => setMode("fixed")}
                label="Valor fixo mensal"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {mode === "percent" ? (
                <div className="space-y-1">
                  <Label htmlFor="obj-pct" className="text-[11px] text-muted-foreground">
                    Percentual (%)
                  </Label>
                  <Input
                    id="obj-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="h-9"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="obj-amount" className="text-[11px] text-muted-foreground">
                    Valor mensal (R$)
                  </Label>
                  <Input
                    id="obj-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="obj-months" className="text-[11px] text-muted-foreground">
                  Em quantos meses
                </Label>
                <Input
                  id="obj-months"
                  type="number"
                  min={1}
                  step={1}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Aporte mensal</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatBRL(monthly)}/mês
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Alvo em {monthsNum} meses</span>
              <span className="font-mono text-foreground">{formatBRL(target)}</span>
            </div>
            {check.error && (
              <p className="text-[11px] text-destructive pt-1">{check.error}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !check.valid || !name.trim()}>
            {saving ? "Criando..." : "Criar objetivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
        active
          ? "border-primary/50 bg-accent/40 text-foreground"
          : "border-border/60 text-muted-foreground hover:bg-accent/20",
      )}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, hint }: { label: string; value: number; hint: string | null }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-sm font-mono font-semibold",
          value < 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {formatBRL(value)}
      </p>
      {hint && <p className="text-[10px] font-mono text-muted-foreground">{hint} vs. real</p>}
    </div>
  );
}

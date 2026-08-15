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
import type { GoalDraft } from "./FinancialOverview";
import type { Goal } from "@/hooks/useGoals";

const PLAN_MONTHS = 12;

type Destination = "new" | "split" | "custom";

/** Confirmação antes de transformar a simulação em meta. */
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
  onConfirm,
  onReinforceGoals,
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
  onConfirm: (draft: GoalDraft) => void;
  onReinforceGoals?: (monthlyPerGoal: number) => void;
}) {
  const fullMonthly = Math.round((simulatedGain + simulatedSaving) * 100) / 100;
  const [destination, setDestination] = useState<Destination>("new");
  const [customMonthly, setCustomMonthly] = useState<string>(String(fullMonthly.toFixed(2)));

  useEffect(() => {
    if (open) {
      setDestination("new");
      setCustomMonthly(String(fullMonthly.toFixed(2)));
    }
  }, [open, fullMonthly]);

  const monthly = useMemo(() => {
    if (destination !== "custom") return fullMonthly;
    const parsed = Number(customMonthly.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(fullMonthly, Math.round(parsed * 100) / 100);
  }, [destination, customMonthly, fullMonthly]);

  const perGoal = goals.length > 0 ? Math.round((fullMonthly / goals.length) * 100) / 100 : 0;

  const handleConfirm = () => {
    if (destination === "split" && goals.length > 0) {
      onReinforceGoals?.(perGoal);
      onOpenChange(false);
      return;
    }
    onConfirm({
      name: "Meta com base na simulação",
      target: Math.round(monthly * PLAN_MONTHS * 100) / 100,
      deadline: deadlineFromMonths(PLAN_MONTHS),
      monthly,
    });
    onOpenChange(false);
  };

  const delta = (a: number, b: number) => {
    const d = a - b;
    if (Math.abs(d) < 0.01) return null;
    return `${d > 0 ? "+" : "−"} ${formatBRL(Math.abs(d))}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Usar o que vai sobrar
          </DialogTitle>
          <DialogDescription>
            Com a simulação atual, veja quanto sobra por mês e escolha o destino desse valor.
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
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatBRL(fullMonthly)}/mês
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Quer criar novas metas com isso?</p>
            <OptionRow
              active={destination === "new"}
              onClick={() => setDestination("new")}
              title="Criar uma nova meta"
              subtitle={`${formatBRL(fullMonthly)}/mês · ${formatBRL(
                fullMonthly * PLAN_MONTHS,
              )} em ${PLAN_MONTHS} meses`}
            />
            {goals.length > 0 && (
              <OptionRow
                active={destination === "split"}
                onClick={() => setDestination("split")}
                title="Reforçar as metas existentes"
                subtitle={`${formatBRL(perGoal)}/mês para cada uma das ${goals.length} metas`}
              />
            )}
            <OptionRow
              active={destination === "custom"}
              onClick={() => setDestination("custom")}
              title="Usar um valor menor"
              subtitle="Guardo só uma parte do que sobra"
            />
            {destination === "custom" && (
              <div className="space-y-1 pl-1">
                <Label htmlFor="custom-monthly" className="text-[11px] text-muted-foreground">
                  Aporte mensal (R$)
                </Label>
                <Input
                  id="custom-monthly"
                  type="number"
                  step="0.01"
                  min={0}
                  max={fullMonthly}
                  value={customMonthly}
                  onChange={(e) => setCustomMonthly(e.target.value)}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Meta de {formatBRL(monthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={destination !== "split" && monthly <= 0}>
            {destination === "split" ? "Reforçar metas" : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function OptionRow({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-2.5 transition-colors",
        active ? "border-primary/50 bg-accent/40" : "border-border/60 hover:bg-accent/20",
      )}
    >
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </button>
  );
}

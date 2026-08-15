import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatBRL } from "@/lib/goalPlanning";
import { cn } from "@/lib/utils";
import type { Goal } from "@/hooks/useGoals";
import {
  GOAL_TYPE_LABELS,
  GOAL_TYPE_ORDER,
  isGoalType,
  monthlyFromAllocation,
  type GoalType,
} from "@/lib/allocation";
import { GoalTypeIcon } from "./goalTypeIcon";

/**
 * Camada 2 do planejamento: os Objetivos (destino da sobra),
 * agrupados por tipo e separados do painel orçamentário.
 */
export function ObjectivesPanel({
  goals,
  leftoverMonthly,
  activeGoalId,
  onSelect,
  onOpenGoal,
  onCreate,
}: {
  goals: Goal[];
  /** Sobra mensal usada para converter alocações percentuais em reais. */
  leftoverMonthly: number;
  activeGoalId: string | null;
  onSelect: (id: string) => void;
  onOpenGoal?: (id: string) => void;
  onCreate: () => void;
}) {
  const groups = useMemo(() => {
    const byType = new Map<GoalType, Goal[]>();
    goals.forEach((g) => {
      const type: GoalType = isGoalType(g.goal_type) ? g.goal_type : "sonho";
      const list = byType.get(type) ?? [];
      list.push(g);
      byType.set(type, list);
    });
    return GOAL_TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      type: t,
      items: byType.get(t)!,
    }));
  }, [goals]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Meus Objetivos</h2>
          <p className="text-xs text-muted-foreground">
            O destino da sobra: reservas, sonhos, investimentos e dívidas.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          Novo objetivo
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card p-5 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum objetivo ainda. Use o que vai sobrar para criar o primeiro.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.type} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                <GoalTypeIcon type={group.type} className="h-3.5 w-3.5" />
                <span>{GOAL_TYPE_LABELS[group.type]}</span>
                <span className="font-mono">({group.items.length})</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((goal) => (
                  <ObjectiveCard
                    key={goal.id}
                    goal={goal}
                    leftoverMonthly={leftoverMonthly}
                    active={goal.id === activeGoalId}
                    onSelect={() => onSelect(goal.id)}
                    onOpen={onOpenGoal ? () => onOpenGoal(goal.id) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ObjectiveCard({
  goal,
  leftoverMonthly,
  active,
  onSelect,
  onOpen,
}: {
  goal: Goal;
  leftoverMonthly: number;
  active: boolean;
  onSelect: () => void;
  onOpen?: () => void;
}) {
  const monthly = monthlyFromAllocation(
    {
      mode: goal.allocation_mode === "percent" ? "percent" : "fixed",
      amount: goal.auto_reserve_amount || 0,
      percent: goal.allocation_percent || 0,
    },
    leftoverMonthly,
  );
  const progress =
    goal.target_amount > 0
      ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
      : 0;
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        "glass-card p-3 text-left space-y-2 transition-colors hover:bg-accent/20",
        active && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate">{goal.name}</p>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono">
          {formatBRL(goal.current_amount)} / {formatBRL(goal.target_amount)}
        </span>
        <span className="font-mono">
          {goal.allocation_mode === "percent"
            ? `${Math.round(goal.allocation_percent || 0)}% da sobra`
            : "valor fixo"}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Aporte</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400">
          {formatBRL(monthly)}/mês
        </span>
      </div>

      {monthsLeft !== null && remaining > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nesse ritmo, conclui em {monthsLeft} {monthsLeft === 1 ? "mês" : "meses"}.
        </p>
      )}
    </button>
  );
}

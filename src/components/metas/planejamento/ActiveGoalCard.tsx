import { formatBRL, type PlanningGoal, type GoalScoreResult } from "@/lib/goalPlanning";
import { GoalStatusBadge } from "./GoalStatusBadge";

interface Props {
  goal: PlanningGoal;
  scoreResult: GoalScoreResult;
  isSimulated?: boolean;
}

export function ActiveGoalCard({ goal, scoreResult, isSimulated }: Props) {
  const progress =
    goal.targetAmount > 0
      ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
      : 0;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Meta ativa
          </p>
          <h3 className="text-lg font-semibold text-foreground truncate">{goal.title}</h3>
        </div>
        <GoalStatusBadge status={scoreResult.status} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-foreground">
          {formatBRL(goal.currentAmount)}
        </span>
        <span className="text-sm text-muted-foreground">de {formatBRL(goal.targetAmount)}</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {goal.deadline
            ? `Prazo: ${new Date(`${goal.deadline}T00:00:00`).toLocaleDateString("pt-BR")}`
            : "Sem prazo definido"}
        </span>
        <span>{progress.toFixed(0)}%</span>
      </div>

      {isSimulated && (
        <p className="text-[11px] text-primary">
          Cenário simulado — nada foi salvo ainda.
        </p>
      )}
    </div>
  );
}

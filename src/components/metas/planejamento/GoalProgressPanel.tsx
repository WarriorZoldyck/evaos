import { GoalScoreRing } from "./GoalScoreRing";
import { GoalScoreBreakdownList } from "./GoalScoreBreakdownList";
import { GoalStatusBadge } from "./GoalStatusBadge";
import type { GoalScoreResult, PlanningGoal } from "@/lib/goalPlanning";
import { formatBRL } from "@/lib/goalPlanning";

interface Props {
  goal: PlanningGoal;
  scoreResult: GoalScoreResult;
}

export function GoalProgressPanel({ goal, scoreResult }: Props) {
  const progress =
    goal.targetAmount > 0
      ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
      : 0;

  const caption =
    scoreResult.status === "DADOS_INSUFICIENTES"
      ? "Precisamos de mais informações para avaliar sua meta."
      : `${progress.toFixed(0)}% do alvo de ${formatBRL(goal.targetAmount)}`;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Progresso da meta
        </p>
        <GoalStatusBadge status={scoreResult.status} />
      </div>

      <GoalScoreRing score={scoreResult.score} label="score" caption={caption} />

      <GoalScoreBreakdownList breakdown={scoreResult.breakdown} />
    </div>
  );
}

import { LifeBuoy, ChevronRight } from "lucide-react";
import type { Goal } from "@/hooks/useGoals";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface GoalListItemProps {
  goal: Goal;
  onClick: (goal: Goal) => void;
}

export function GoalListItem({ goal, onClick }: GoalListItemProps) {
  const progress = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0;
  const isCompleted = progress >= 100;

  return (
    <button
      onClick={() => onClick(goal)}
      className="w-full flex items-center gap-4 py-4 px-1 text-left group hover:bg-accent/40 transition-colors rounded-lg"
    >
      <div className={`
        h-12 w-12 shrink-0 rounded-full flex items-center justify-center
        ${isCompleted ? "bg-success/15" : "bg-primary/10"}
      `}>
        <LifeBuoy className={`h-6 w-6 ${isCompleted ? "text-success" : "text-primary"}`} strokeWidth={1.75} />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground truncate">{goal.name}</p>
          <p className="font-semibold font-mono text-foreground whitespace-nowrap text-sm">
            {formatCurrency(goal.current_amount)}
          </p>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isCompleted ? "bg-success" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">
            Meta {formatCurrency(goal.target_amount)}
          </p>
          <p className="text-xs text-muted-foreground font-medium tabular-nums">
            {progress.toFixed(0)}%
          </p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

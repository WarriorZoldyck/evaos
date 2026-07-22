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
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card hover:bg-accent/50 border border-border transition-colors text-left group"
    >
      <div className={`
        relative h-14 w-14 shrink-0 rounded-full flex items-center justify-center
        ${isCompleted ? "bg-success/15" : "bg-primary/10"}
      `}>
        <LifeBuoy className={`h-7 w-7 ${isCompleted ? "text-success" : "text-primary"}`} />
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="25" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
          <circle
            cx="28" cy="28" r="25"
            fill="none"
            stroke={isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))"}
            strokeWidth="2.5"
            strokeDasharray={`${(progress / 100) * 157} 157`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{goal.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          Meta: {formatCurrency(goal.target_amount)} · {progress.toFixed(0)}%
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-bold font-mono text-foreground whitespace-nowrap">
          {formatCurrency(goal.current_amount)}
        </p>
      </div>

      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

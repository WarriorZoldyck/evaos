import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/goalPlanning";
import type { Goal } from "@/hooks/useGoals";

interface Props {
  goals: Goal[];
  activeGoalId: string | null;
  onSelect: (goalId: string) => void;
  onOpen: (goal: Goal) => void;
  onCreate: () => void;
}

export function GoalSelectorList({ goals, activeGoalId, onSelect, onOpen, onCreate }: Props) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Meus cofrinhos
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label="Nova meta"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum cofrinho ainda. Crie o primeiro para começar o planejamento.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {goals.map((g) => {
            const pct =
              g.target_amount > 0
                ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                : 0;
            const active = g.id === activeGoalId;
            return (
              <li key={g.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(g.id)}
                  className={cn(
                    "flex-1 min-w-0 text-left rounded-xl px-3 py-2 transition-colors",
                    active ? "bg-primary/10" : "hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm truncate",
                        active ? "font-semibold text-foreground" : "text-foreground",
                      )}
                    >
                      {g.name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {formatBRL(g.current_amount)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(g)}
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-1"
                >
                  abrir
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

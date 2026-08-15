import { useMemo } from "react";
import { Brain, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/goalPlanning";
import { buildGoalInsight, type GoalInsightStatus } from "@/lib/goalInsight";
import type { Goal } from "@/hooks/useGoals";

const STATUS_STYLES: Record<GoalInsightStatus, { label: string; className: string }> = {
  done: { label: "Concluída", className: "text-emerald-600 dark:text-emerald-400" },
  on_track: { label: "Dentro do ritmo", className: "text-emerald-600 dark:text-emerald-400" },
  slightly_behind: { label: "Levemente atrás", className: "text-amber-600 dark:text-amber-400" },
  off_track: { label: "Fora do ritmo", className: "text-destructive" },
  no_deadline: { label: "Sem prazo", className: "text-muted-foreground" },
};

/** Card lateral: acompanhamento determinístico de cada meta pela EVA. */
export function GoalInsightCard({
  goals,
  activeGoalId,
  monthlyCapacity,
}: {
  goals: Goal[];
  activeGoalId: string | null;
  monthlyCapacity: number;
}) {
  const insights = useMemo(
    () =>
      goals.map((g) =>
        buildGoalInsight(
          {
            id: g.id,
            name: g.name,
            target: Number(g.target_amount) || 0,
            current: Number(g.current_amount) || 0,
            deadline: g.deadline,
          },
          monthlyCapacity,
        ),
      ),
    [goals, monthlyCapacity],
  );

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Insight da EVA
        </h3>
      </div>

      {insights.length === 0 ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Nenhum cofrinho ainda. Simule um corte ou um ganho acima e crie a primeira meta para
          acompanhar aqui quanto você já alcançou e se está no ritmo.
        </p>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {insights.map((i) => {
            const style = STATUS_STYLES[i.status];
            const isActive = i.id === activeGoalId;
            return (
              <div
                key={i.id}
                className={cn(
                  "rounded-xl border border-border/50 p-2.5 space-y-1.5",
                  isActive && "ring-1 ring-primary/40 bg-accent/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-xs font-semibold text-foreground">{i.name}</span>
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {formatBRL(i.target)}
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${i.progressPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>
                    {formatBRL(i.current)} · {Math.round(i.progressPct)}%
                  </span>
                  <span>faltam {formatBRL(i.remaining)}</span>
                </div>

                {i.monthsLeft !== null && i.remaining > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Precisa de{" "}
                    <span className="font-mono text-foreground">{formatBRL(i.requiredMonthly)}</span>
                    /mês em {i.monthsLeft} {i.monthsLeft === 1 ? "mês" : "meses"} · simulação permite{" "}
                    <span className="font-mono text-foreground">{formatBRL(monthlyCapacity)}</span>
                  </p>
                )}

                <p className={cn("text-[11px] font-medium leading-snug", style.className)}>
                  {style.label} — {i.message}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

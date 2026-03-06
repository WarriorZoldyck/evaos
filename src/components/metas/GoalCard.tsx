import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LifeBuoy, Settings, Plus, Minus, Trash2, History,
  CalendarDays, Target,
} from "lucide-react";
import type { Goal } from "@/hooks/useGoals";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null) => {
  if (!d) return "Sem prazo";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
};

interface GoalCardProps {
  goal: Goal;
  onReserve: (goal: Goal) => void;
  onWithdraw: (goal: Goal) => void;
  onConfigure: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onHistory: (goal: Goal) => void;
}

export function GoalCard({ goal, onReserve, onWithdraw, onConfigure, onDelete, onHistory }: GoalCardProps) {
  const progress = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0;

  const isCompleted = progress >= 100;
  const daysLeft = goal.deadline
    ? Math.max(0, Math.ceil((new Date(goal.deadline + "T00:00:00").getTime() - Date.now()) / 86400000))
    : null;

  return (
    <Card className="card-hover overflow-hidden group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Life Buoy Icon */}
          <div className={`
            relative h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center
            ${isCompleted
              ? "bg-gradient-success text-success-foreground"
              : "bg-gradient-primary-soft"
            }
          `}>
            <LifeBuoy className={`h-8 w-8 ${isCompleted ? "text-white" : "text-primary"}`} />
            {/* Radar ring */}
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="3"
              />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke={isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))"}
                strokeWidth="3"
                strokeDasharray={`${progress * 1.76} 176`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{goal.name}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <CalendarDays className="h-3 w-3" />
                  <span>{formatDate(goal.deadline)}</span>
                  {daysLeft !== null && !isCompleted && (
                    <Badge variant={daysLeft < 30 ? "destructive" : "secondary"} className="text-[10px] px-1.5">
                      {daysLeft}d restantes
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge className="text-[10px] px-1.5 bg-success text-success-foreground border-0">
                      Atingida!
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-lg font-bold font-mono text-foreground whitespace-nowrap">
                {formatCurrency(goal.current_amount)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{progress.toFixed(0)}% da meta</span>
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {formatCurrency(goal.target_amount)}
                </span>
              </div>
            </div>

            {/* Auto-reserve info */}
            {goal.auto_reserve_enabled && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                Reserva automática: {formatCurrency(goal.auto_reserve_amount)}
                {goal.auto_reserve_frequency === "weekly" && " / semana"}
                {goal.auto_reserve_frequency === "biweekly" && " / quinzena"}
                {goal.auto_reserve_frequency === "monthly" && " / mês"}
                {goal.auto_reserve_per_expense > 0 && ` + ${formatCurrency(goal.auto_reserve_per_expense)} por gasto`}
                {goal.auto_reserve_per_sale > 0 && ` + ${formatCurrency(goal.auto_reserve_per_sale)} por venda`}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onReserve(goal)}>
                <Plus className="h-3 w-3" /> Reservar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onWithdraw(goal)}>
                <Minus className="h-3 w-3" /> Retirar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onHistory(goal)}>
                <History className="h-3 w-3" /> Histórico
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onConfigure(goal)}>
                <Settings className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => onDelete(goal)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

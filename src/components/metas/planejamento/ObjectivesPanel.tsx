import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  onEditGoal,
  onDeleteGoal,
  onCreate,
}: {
  goals: Goal[];
  /** Sobra mensal usada para converter alocações percentuais em reais. */
  leftoverMonthly: number;
  activeGoalId: string | null;
  onSelect: (id: string) => void;
  onOpenGoal?: (id: string) => void;
  onEditGoal?: (id: string) => void;
  onDeleteGoal?: (id: string) => void | Promise<void>;
  onCreate: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

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
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Meus Objetivos</h2>
          <p className="text-[11px] text-muted-foreground">
            O destino da sobra: reservas, sonhos, investimentos e dívidas.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" />
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
              <div className="space-y-2">
                {group.items.map((goal) => (
                  <ObjectiveCard
                    key={goal.id}
                    goal={goal}
                    leftoverMonthly={leftoverMonthly}
                    active={goal.id === activeGoalId}
                    onSelect={() => onSelect(goal.id)}
                    onOpen={onOpenGoal ? () => onOpenGoal(goal.id) : undefined}
                    onEdit={onEditGoal ? () => onEditGoal(goal.id) : undefined}
                    onDelete={onDeleteGoal ? () => setPendingDelete(goal) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O objetivo e todo o histórico de reservas e retiradas dele serão apagados.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target && onDeleteGoal) await onDeleteGoal(target.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ObjectiveCard({
  goal,
  leftoverMonthly,
  active,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  leftoverMonthly: number;
  active: boolean;
  onSelect: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

  return (
    <div
      className={cn(
        "glass-card p-3 space-y-2 transition-colors",
        active && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={() => {
            onSelect();
            onOpen?.();
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold text-foreground truncate">{goal.name}</p>
        </button>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0 pt-0.5">
          {Math.round(progress)}%
        </span>
        {(onOpen || onEdit || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -mr-1"
                aria-label={`Ações de ${goal.name}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onOpen && (
                <DropdownMenuItem onClick={onOpen}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono truncate">
          {formatBRL(goal.current_amount)} / {formatBRL(goal.target_amount)}
        </span>
        <span className="font-mono shrink-0 text-emerald-600 dark:text-emerald-400">
          {formatBRL(monthly)}/mês
        </span>
      </div>
    </div>
  );
}

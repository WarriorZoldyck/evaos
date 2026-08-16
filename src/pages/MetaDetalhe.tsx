import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Minus, Settings, Trash2, CalendarDays, MoreVertical,
  ArrowUpCircle, ArrowDownCircle, Zap, TrendingDown, ChevronRight, Check, Pencil,
} from "lucide-react";
import { useGoals, type GoalMovement } from "@/hooks/useGoals";
import { GoalRadarLarge } from "@/components/metas/GoalRadarLarge";
import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { GoalAmountModal } from "@/components/metas/GoalAmountModal";
import { GoalHistoryModal } from "@/components/metas/GoalHistoryModal";
import { useMetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { usePlanningGoal } from "@/hooks/usePlanningGoal";
import { ActiveGoalCard } from "@/components/metas/planejamento/ActiveGoalCard";
import { GoalProgressPanel } from "@/components/metas/planejamento/GoalProgressPanel";
import { GoalResolutionPanel } from "@/components/metas/planejamento/GoalResolutionPanel";
import { ActionPlanList } from "@/components/metas/planejamento/ActionPlanList";
import { GoalChat } from "@/components/metas/planejamento/GoalChat";
import { LocalAssistantService } from "@/services/assistant/LocalAssistantService";
import type {
  AssistantReply,
  ChatMessage,
  GoalPlanningContext,
} from "@/services/assistant/AssistantService";
import { needsResolution } from "@/lib/goalPlanning";

const assistantService = new LocalAssistantService();
const CHAT_CHIPS = ["Até 6 meses", "1 ano", "2 anos", "Consigo guardar R$ 800 por mês"];


const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateLong = (d: string) => {
  const date = new Date(d + "T00:00:00");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${date.getDate()}/${months[date.getMonth()]}/${date.getFullYear()}`;
};

const groupKey = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yest)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
};

export default function MetaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    goals, loading,
    updateGoal, deleteGoal,
    reserveAmount, withdrawAmount, fetchMovements,
  } = useGoals();

  const goal = goals.find((g) => g.id === id);

  const [configOpen, setConfigOpen] = useState(false);
  const [amountType, setAmountType] = useState<"reserve" | "withdraw" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movements, setMovements] = useState<GoalMovement[]>([]);
  const [movLoading, setMovLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setMovLoading(true);
    fetchMovements(id).then((data) => {
      setMovements(data);
      setMovLoading(false);
    });
  }, [id, fetchMovements, goal?.current_amount]);

  const progress = useMemo(() => {
    if (!goal || goal.target_amount <= 0) return 0;
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  }, [goal]);

  const isCompleted = progress >= 100;
  const canWithdraw = (goal?.current_amount ?? 0) > 0;

  const daysLeft = goal?.deadline
    ? Math.ceil((new Date(goal.deadline + "T00:00:00").getTime() - Date.now()) / 86400000)
    : null;

  const grouped = useMemo(() => {
    const map = new Map<string, GoalMovement[]>();
    for (const m of movements.slice(0, 5)) {
      const k = groupKey(m.created_at);
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [movements]);

  if (loading && !goal) {
    return (
      <div className="metas-scope space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-56 mx-auto rounded-full" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="metas-scope flex flex-col items-center justify-center py-20 text-center max-w-2xl mx-auto">
        <p className="text-muted-foreground">Cofrinho não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/metas")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const freqLabel = goal.auto_reserve_frequency === "weekly" ? "Semanal"
    : goal.auto_reserve_frequency === "biweekly" ? "Quinzenal"
    : goal.auto_reserve_frequency === "monthly" ? "Mensal" : null;

  const hasFrequency = goal.auto_reserve_enabled && !!freqLabel && goal.auto_reserve_amount > 0;
  const hasByEvent = goal.auto_reserve_enabled && (goal.auto_reserve_per_expense > 0 || goal.auto_reserve_per_sale > 0);

  return (
    <div className="metas-scope space-y-8 animate-fade-in max-w-2xl mx-auto pb-8">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/metas")} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-center font-semibold text-foreground truncate">{goal.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mais opções">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setConfigOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Herói */}
      <div className="space-y-5">
        <GoalRadarLarge progress={progress} isCompleted={isCompleted} />
        <div className="text-center space-y-1.5">
          <p className="text-5xl font-bold font-mono text-foreground tracking-tight">
            {formatCurrency(goal.current_amount)}
          </p>
          <p className="text-sm text-muted-foreground">
            de {formatCurrency(goal.target_amount)} · {progress.toFixed(0)}%
          </p>
          {goal.deadline && !isCompleted && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 pt-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {daysLeft !== null && daysLeft < 0
                ? `Prazo expirado em ${formatDateLong(goal.deadline)}`
                : `Prazo: ${formatDateLong(goal.deadline)}`}
            </p>
          )}
          {isCompleted && (
            <div className="pt-1">
              <Badge className="bg-success text-success-foreground border-0 gap-1">
                <Check className="h-3 w-3" /> Meta atingida!
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Ações em pílula */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Button
          onClick={() => setAmountType("reserve")}
          size="lg"
          className="rounded-full flex-1 sm:flex-none sm:px-8 gap-2"
        >
          <Plus className="h-4 w-4" /> Reservar
        </Button>
        <Button
          onClick={() => canWithdraw && setAmountType("withdraw")}
          disabled={!canWithdraw}
          variant="outline"
          size="lg"
          className="rounded-full flex-1 sm:flex-none sm:px-8 gap-2"
        >
          <Minus className="h-4 w-4" /> Retirar
        </Button>
        <Button
          onClick={() => setConfigOpen(true)}
          variant="ghost"
          size="lg"
          className="rounded-full gap-2"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Configurar</span>
        </Button>
      </div>

      {/* Auto reserve */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Guarde automaticamente
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
          <button
            onClick={() => setConfigOpen(true)}
            className="w-full flex items-center gap-4 p-4 text-left hover:bg-accent/40 transition-colors"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-foreground text-sm">Por frequência</p>
                {hasFrequency && (
                  <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 text-[10px] px-1.5 h-4">
                    Ativo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {hasFrequency
                  ? `${freqLabel} · ${formatCurrency(goal.auto_reserve_amount)}`
                  : "Semanal, quinzenal ou mensal"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => setConfigOpen(true)}
            className="w-full flex items-center gap-4 p-4 text-left hover:bg-accent/40 transition-colors"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-foreground text-sm">Por gasto ou venda</p>
                {hasByEvent && (
                  <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 text-[10px] px-1.5 h-4">
                    Ativo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {hasByEvent
                  ? [
                      goal.auto_reserve_per_expense > 0 && `${formatCurrency(goal.auto_reserve_per_expense)}/gasto`,
                      goal.auto_reserve_per_sale > 0 && `${formatCurrency(goal.auto_reserve_per_sale)}/venda`,
                    ].filter(Boolean).join(" · ")
                  : "Cada transação te aproxima do objetivo"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>

      {/* Movimentações */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Movimentações
          </h2>
          {movements.length > 5 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver todas
            </button>
          )}
        </div>

        {movLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma movimentação ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([label, items]) => (
              <div key={label}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">
                  {label}
                </p>
                <div className="divide-y divide-border">
                  {items.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-3 px-1">
                      {m.type === "reserve" ? (
                        <ArrowUpCircle className="h-6 w-6 text-success shrink-0" />
                      ) : (
                        <ArrowDownCircle className="h-6 w-6 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">
                          {m.description || (m.type === "reserve" ? "Dinheiro reservado" : "Dinheiro retirado")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className={`text-sm font-mono font-semibold whitespace-nowrap ${m.type === "reserve" ? "text-success" : "text-destructive"}`}>
                        {m.type === "reserve" ? "+" : "-"}{formatCurrency(m.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      <GoalFormModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        editGoal={goal}
        onSave={async () => false}
        onUpdate={updateGoal}
      />

      <GoalAmountModal
        open={amountType !== null}
        onClose={() => setAmountType(null)}
        goal={goal}
        type={amountType || "reserve"}
        onConfirm={amountType === "withdraw" ? withdrawAmount : reserveAmount}
      />

      <GoalHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        goal={goal}
        fetchMovements={fetchMovements}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cofrinho "{goal.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todo o histórico de movimentações será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const ok = await deleteGoal(goal.id);
                if (ok) navigate("/metas");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

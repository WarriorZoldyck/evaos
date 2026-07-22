import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Minus, Settings, Trash2, CalendarDays,
  ArrowUpCircle, ArrowDownCircle, Zap, TrendingDown, ChevronRight, Check,
} from "lucide-react";
import { useGoals, type GoalMovement } from "@/hooks/useGoals";
import { GoalRadarLarge } from "@/components/metas/GoalRadarLarge";
import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { GoalAmountModal } from "@/components/metas/GoalAmountModal";
import { GoalHistoryModal } from "@/components/metas/GoalHistoryModal";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateLong = (d: string) => {
  const date = new Date(d + "T00:00:00");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${date.getDate()}/${months[date.getMonth()]}/${date.getFullYear()}`;
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

  if (loading && !goal) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 w-52 mx-auto rounded-full" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-2xl mx-auto">
        <p className="text-muted-foreground">Meta não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/metas")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Metas
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
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto pb-8">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/metas")} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Metas
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Título + prazo */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold font-display text-foreground">{goal.name}</h1>
        {goal.deadline ? (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {isCompleted
              ? "Meta atingida"
              : daysLeft !== null && daysLeft < 0
                ? `Prazo expirado em ${formatDateLong(goal.deadline)}`
                : `O prazo acaba em ${formatDateLong(goal.deadline)}`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem prazo definido</p>
        )}
      </div>

      {/* Radar + saldo */}
      <div className="space-y-3">
        <GoalRadarLarge progress={progress} isCompleted={isCompleted} />
        <div className="text-center space-y-1">
          <p className="text-4xl font-bold font-mono text-foreground">{formatCurrency(goal.current_amount)}</p>
          <p className="text-sm text-muted-foreground">
            {progress.toFixed(0)}% de {formatCurrency(goal.target_amount)}
          </p>
          {isCompleted && (
            <Badge className="bg-success text-success-foreground border-0 gap-1 mt-1">
              <Check className="h-3 w-3" /> Meta atingida!
            </Badge>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setAmountType("reserve")}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-primary/10 hover:bg-primary/15 transition-colors"
        >
          <Plus className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium text-primary">Reservar</span>
        </button>
        <button
          onClick={() => canWithdraw && setAmountType("withdraw")}
          disabled={!canWithdraw}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Retirar</span>
        </button>
        <button
          onClick={() => setConfigOpen(true)}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-primary/10 hover:bg-primary/15 transition-colors"
        >
          <Settings className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium text-primary">Configurar</span>
        </button>
      </div>

      {/* Auto reserve */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Guarde dinheiro automaticamente</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-foreground">Por frequência</p>
              {hasFrequency ? (
                <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 text-[10px] px-1.5">Ativo</Badge>
              ) : (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[10px] px-1.5">Recomendado</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasFrequency
                ? `${freqLabel} · ${formatCurrency(goal.auto_reserve_amount)}`
                : "Semanal, quinzenal ou mensal."}
            </p>
          </button>

          <button
            onClick={() => setConfigOpen(true)}
            className="text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-foreground">Por gasto/venda</p>
              {hasByEvent ? (
                <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 text-[10px] px-1.5">Ativo</Badge>
              ) : (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[10px] px-1.5">Recomendado</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasByEvent
                ? [
                    goal.auto_reserve_per_expense > 0 && `${formatCurrency(goal.auto_reserve_per_expense)} por gasto`,
                    goal.auto_reserve_per_sale > 0 && `${formatCurrency(goal.auto_reserve_per_sale)} por venda`,
                  ].filter(Boolean).join(" · ")
                : "Cada gasto ou venda aproxima do objetivo."}
            </p>
          </button>
        </div>
      </div>

      {/* Movimentações */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Movimentações</h2>
          {movements.length > 5 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-sm text-primary hover:underline font-medium"
            >
              Ver todas →
            </button>
          )}
        </div>

        {movLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma movimentação ainda. Comece reservando um valor.
          </p>
        ) : (
          <div className="space-y-2">
            {movements.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                {m.type === "reserve" ? (
                  <ArrowUpCircle className="h-8 w-8 text-success shrink-0" />
                ) : (
                  <ArrowDownCircle className="h-8 w-8 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {m.description || (m.type === "reserve" ? "Dinheiro reservado" : "Dinheiro retirado")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {" · "}
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className={`text-sm font-mono font-semibold whitespace-nowrap ${m.type === "reserve" ? "text-success" : "text-destructive"}`}>
                  {m.type === "reserve" ? "+" : "-"}{formatCurrency(m.amount)}
                </p>
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
            <AlertDialogTitle>Excluir meta "{goal.name}"?</AlertDialogTitle>
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

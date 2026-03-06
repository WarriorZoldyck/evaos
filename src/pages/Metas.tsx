import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LifeBuoy, Plus } from "lucide-react";
import { useGoals, type Goal } from "@/hooks/useGoals";
import { useCompany } from "@/contexts/CompanyContext";
import { GoalCard } from "@/components/metas/GoalCard";
import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { GoalAmountModal } from "@/components/metas/GoalAmountModal";
import { GoalHistoryModal } from "@/components/metas/GoalHistoryModal";

export default function Metas() {
  const { isPersonal } = useCompany();
  const {
    goals, loading,
    createGoal, updateGoal, deleteGoal,
    reserveAmount, withdrawAmount, fetchMovements,
  } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [amountGoal, setAmountGoal] = useState<Goal | null>(null);
  const [amountType, setAmountType] = useState<"reserve" | "withdraw">("reserve");
  const [historyGoal, setHistoryGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const openCreate = () => { setEditGoal(null); setFormOpen(true); };
  const openConfigure = (g: Goal) => { setEditGoal(g); setFormOpen(true); };
  const openReserve = (g: Goal) => { setAmountGoal(g); setAmountType("reserve"); };
  const openWithdraw = (g: Goal) => { setAmountGoal(g); setAmountType("withdraw"); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteGoal(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina e acompanhe suas metas financeiras — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <LifeBuoy className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Nenhuma meta criada</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Crie sua primeira meta financeira para começar a guardar dinheiro e atingir seus objetivos.
          </p>
          <Button onClick={openCreate} className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Criar primeira meta
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onReserve={openReserve}
              onWithdraw={openWithdraw}
              onConfigure={openConfigure}
              onDelete={setDeleteTarget}
              onHistory={setHistoryGoal}
            />
          ))}
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditGoal(null); }}
        editGoal={editGoal}
        onSave={createGoal}
        onUpdate={updateGoal}
      />

      <GoalAmountModal
        open={!!amountGoal}
        onClose={() => setAmountGoal(null)}
        goal={amountGoal}
        type={amountType}
        onConfirm={amountType === "reserve" ? reserveAmount : withdrawAmount}
      />

      <GoalHistoryModal
        open={!!historyGoal}
        onClose={() => setHistoryGoal(null)}
        goal={historyGoal}
        fetchMovements={fetchMovements}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todo o histórico de movimentações será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

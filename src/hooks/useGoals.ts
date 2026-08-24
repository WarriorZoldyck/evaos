import { mapDatabaseError } from "@/lib/errorMapper";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { ensureGoalCategory, renameGoalCategory, fetchGoalLinkedAmounts } from "@/lib/goalCategory";


export interface Goal {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  auto_reserve_enabled: boolean;
  auto_reserve_frequency: string | null;
  auto_reserve_per_expense: number;
  auto_reserve_per_sale: number;
  auto_reserve_amount: number;
  icon: string;
  goal_type: string;
  allocation_mode: string;
  allocation_percent: number;
  created_at: string;
  /** Aportes manuais registrados em goal_movements. */
  manual_amount?: number;
  /** Somatório das transferências categorizadas em "Metas > [objetivo]". */
  linked_amount?: number;
}


export interface GoalMovement {
  id: string;
  goal_id: string;
  user_id: string;
  type: string; // 'reserve' | 'withdraw'
  amount: number;
  description: string | null;
  created_at: string;
}

export function useGoals() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("goals").select("*").eq("user_id", effectiveUserId).order("created_at", { ascending: false });
    if (isPersonal) query = query.is("company_id", null);
    else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar metas", description: mapDatabaseError(error), variant: "destructive" });
    } else {
      const rows = (data as Goal[]) || [];
      const linked = await fetchGoalLinkedAmounts(
        effectiveUserId,
        isPersonal ? null : selectedCompanyId || null,
        rows.map((g) => g.name),
      );
      setGoals(
        rows.map((g) => {
          const manual = Number(g.current_amount) || 0;
          const fromTx = Number(linked[g.name] || 0);
          return { ...g, manual_amount: manual, linked_amount: fromTx, current_amount: manual + fromTx };
        }),
      );
    }
    setLoading(false);
  }, [user, effectiveUserId, isPersonal, selectedCompanyId, toast]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const createGoal = async (data: {
    name: string;
    target_amount: number;
    deadline?: string | null;
    auto_reserve_enabled?: boolean;
    auto_reserve_frequency?: string | null;
    auto_reserve_amount?: number;
    auto_reserve_per_expense?: number;
    auto_reserve_per_sale?: number;
    goal_type?: string;
    allocation_mode?: string;
    allocation_percent?: number;
  }) => {
    if (!user) return false;
    const { error } = await supabase.from("goals").insert({
      name: data.name,
      target_amount: data.target_amount,
      deadline: data.deadline || null,
      auto_reserve_enabled: data.auto_reserve_enabled ?? false,
      auto_reserve_frequency: data.auto_reserve_enabled ? (data.auto_reserve_frequency || "monthly") : null,
      auto_reserve_amount: data.auto_reserve_amount ?? 0,
      auto_reserve_per_expense: data.auto_reserve_per_expense ?? 0,
      auto_reserve_per_sale: data.auto_reserve_per_sale ?? 0,
      goal_type: data.goal_type ?? "sonho",
      allocation_mode: data.allocation_mode ?? "fixed",
      allocation_percent: data.allocation_percent ?? 0,
      user_id: effectiveUserId,
      company_id: selectedCompanyId || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao criar meta", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    // Cria "Metas > [objetivo]" para o usuário categorizar as transferências.
    const catId = await ensureGoalCategory(
      effectiveUserId,
      isPersonal ? null : selectedCompanyId || null,
      data.name,
    );
    toast({
      title: "Meta criada!",
      description: catId ? `Categoria "Metas > ${data.name}" disponível nos lançamentos.` : undefined,
    });
    fetchGoals();
    return true;
  };


  const updateGoal = async (id: string, data: Partial<Goal>) => {
    const previous = goals.find((g) => g.id === id);
    const payload = { ...data };
    delete (payload as any).manual_amount;
    delete (payload as any).linked_amount;
    const { error } = await supabase.from("goals").update(payload as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar meta", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    const ctxCompany = isPersonal ? null : selectedCompanyId || null;
    if (data.name && previous && previous.name !== data.name) {
      await renameGoalCategory(effectiveUserId, ctxCompany, previous.name, data.name);
    } else if (data.name || previous?.name) {
      await ensureGoalCategory(effectiveUserId, ctxCompany, (data.name || previous!.name) as string);
    }
    toast({ title: "Meta atualizada!" });
    fetchGoals();
    return true;
  };


  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir meta", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Meta excluída!" });
    fetchGoals();
    return true;
  };

  const reserveAmount = async (goalId: string, amount: number, description?: string) => {
    if (!user) return false;
    const { error: moveErr } = await supabase.from("goal_movements").insert({
      goal_id: goalId,
      user_id: effectiveUserId,
      type: "reserve",
      amount,
      description: description || "Reserva manual",
    } as any);
    if (moveErr) {
      toast({ title: "Erro ao reservar", description: moveErr.message, variant: "destructive" });
      return false;
    }
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      const manual = Number(goal.manual_amount ?? goal.current_amount) || 0;
      await supabase.from("goals").update({ current_amount: manual + amount } as any).eq("id", goalId);

    }
    toast({ title: "Valor reservado!" });
    fetchGoals();
    return true;
  };

  const withdrawAmount = async (goalId: string, amount: number, description?: string) => {
    if (!user) return false;
    const { error: moveErr } = await supabase.from("goal_movements").insert({
      goal_id: goalId,
      user_id: effectiveUserId,
      type: "withdraw",
      amount,
      description: description || "Retirada manual",
    } as any);
    if (moveErr) {
      toast({ title: "Erro ao retirar", description: moveErr.message, variant: "destructive" });
      return false;
    }
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      await supabase.from("goals").update({ current_amount: Math.max(0, goal.current_amount - amount) } as any).eq("id", goalId);
    }
    toast({ title: "Valor retirado!" });
    fetchGoals();
    return true;
  };

  const fetchMovements = async (goalId: string): Promise<GoalMovement[]> => {
    const { data } = await supabase
      .from("goal_movements")
      .select("*")
      .eq("goal_id", goalId)
      .order("created_at", { ascending: false }) as any;
    return (data as GoalMovement[]) || [];
  };

  return {
    goals, loading, refetch: fetchGoals,
    createGoal, updateGoal, deleteGoal,
    reserveAmount, withdrawAmount, fetchMovements,
  };
}

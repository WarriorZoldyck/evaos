import { useMemo, useState } from "react";
import type { Goal } from "@/hooks/useGoals";

/**
 * Seleção da meta ativa. Estado de interface — não persiste no banco.
 * O fallback para a primeira meta é apenas valor inicial, não regra de negócio.
 */
export function useActiveGoal(goals: Goal[]) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);

  const activeGoal = useMemo(() => {
    if (goals.length === 0) return null;
    return goals.find((g) => g.id === activeGoalId) ?? goals[0];
  }, [goals, activeGoalId]);

  return { activeGoalId: activeGoal?.id ?? null, setActiveGoalId, activeGoal };
}

import { useCallback, useMemo, useState } from "react";
import type { Goal } from "@/hooks/useGoals";
import {
  applyResolution,
  buildActionPlan,
  computeGoalScore,
  type ActionPlanItem,
  type CategoryAmount,
  type GoalResolutionAction,
  type GoalScenario,
  type PlanningGoal,
} from "@/lib/goalPlanning";

export function toPlanningGoal(goal: Goal): PlanningGoal {
  return {
    id: goal.id,
    title: goal.name,
    targetAmount: Number(goal.target_amount) || 0,
    currentAmount: Number(goal.current_amount) || 0,
    deadline: goal.deadline,
    // Aporte PLANEJADO da meta — não é a sobra mensal do usuário.
    monthlyContribution: Number(goal.auto_reserve_amount) || 0,
  };
}

interface Params {
  goal: Goal | null;
  /** Capacidade financeira mensal estimada. */
  monthlyCapacity: number;
  topCategories: CategoryAmount[];
}

/**
 * Cenário de planejamento da meta ativa.
 * Toda a matemática vem de funções puras — nada é calculado em componente.
 * Simulações ficam apenas na sessão; nada é gravado no banco.
 */
export function usePlanningGoal({ goal, monthlyCapacity, topCategories }: Params) {
  const baseScenario = useMemo<GoalScenario | null>(
    () => (goal ? { goal: toPlanningGoal(goal), monthlyCapacity } : null),
    [goal, monthlyCapacity],
  );

  const [override, setOverride] = useState<{ goalId: string; scenario: GoalScenario } | null>(null);

  const scenario = useMemo<GoalScenario | null>(() => {
    if (!baseScenario) return null;
    if (override && override.goalId === baseScenario.goal.id) return override.scenario;
    return baseScenario;
  }, [baseScenario, override]);

  const isSimulated = Boolean(
    scenario && baseScenario && override?.goalId === baseScenario.goal.id,
  );

  const scoreResult = useMemo(
    () =>
      scenario
        ? computeGoalScore({
            goal: scenario.goal,
            monthlyCapacity: scenario.monthlyCapacity,
          })
        : null,
    [scenario],
  );

  const [aiActions, setAiActions] = useState<ActionPlanItem[]>([]);

  const actionPlan = useMemo<ActionPlanItem[]>(() => {
    if (!scoreResult) return aiActions;
    return [...buildActionPlan(scoreResult.breakdown, topCategories), ...aiActions];
  }, [scoreResult, topCategories, aiActions]);

  const dispatchResolution = useCallback(
    (action: GoalResolutionAction) => {
      if (!scenario) return;
      setOverride({ goalId: scenario.goal.id, scenario: applyResolution(scenario, action) });
    },
    [scenario],
  );

  const patchGoal = useCallback(
    (patch: Partial<PlanningGoal>) => {
      if (!scenario) return;
      setOverride({
        goalId: scenario.goal.id,
        scenario: { ...scenario, goal: { ...scenario.goal, ...patch } },
      });
    },
    [scenario],
  );

  const addAiActions = useCallback((items: ActionPlanItem[]) => {
    if (items.length === 0) return;
    setAiActions((prev) => [...prev, ...items]);
  }, []);

  const resetScenario = useCallback(() => {
    setOverride(null);
    setAiActions([]);
  }, []);

  return {
    scenario,
    planningGoal: scenario?.goal ?? null,
    scoreResult,
    actionPlan,
    isSimulated,
    dispatchResolution,
    patchGoal,
    addAiActions,
    resetScenario,
  };
}

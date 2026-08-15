import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles } from "lucide-react";

import { useGoals, type Goal } from "@/hooks/useGoals";
import { useCompany } from "@/contexts/CompanyContext";
import { useMetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { useActiveGoal } from "@/hooks/useActiveGoal";
import { usePlanningGoal } from "@/hooks/usePlanningGoal";

import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { ActionPlanDialog } from "@/components/metas/ActionPlanDialog";
import {
  OverviewSkeleton,
  OverviewHeader,
  RealBalanceCard,
  RealAverageBlock,
  RealCapacityCard,
  RealLeftoverCard,
  OverviewDetailPanel,
  SimulatedCategoryList,
  SimulationSummary,
  GainTotalCard,
  SavingGoalCard,
  sumSimulated,
} from "@/components/metas/planejamento/FinancialOverview";

import { cn } from "@/lib/utils";
import { ActiveGoalCard } from "@/components/metas/planejamento/ActiveGoalCard";
import { GoalChat } from "@/components/metas/planejamento/GoalChat";
import { GoalSelectorList } from "@/components/metas/planejamento/GoalSelectorList";
import { GoalProgressPanel } from "@/components/metas/planejamento/GoalProgressPanel";
import { ActionPlanList } from "@/components/metas/planejamento/ActionPlanList";
import { GoalResolutionPanel } from "@/components/metas/planejamento/GoalResolutionPanel";

import { needsResolution } from "@/lib/goalPlanning";
import { LocalAssistantService } from "@/services/assistant/LocalAssistantService";
import type {
  AssistantReply,
  ChatMessage,
  GoalPlanningContext,
} from "@/services/assistant/AssistantService";

const CHAT_CHIPS = ["Até 6 meses", "1 ano", "2 anos", "Consigo guardar R$ 800 por mês"];

// Injeção da implementação temporária — a UI conhece apenas a interface.
const assistantService = new LocalAssistantService();

/** Linha pareada: número real à esquerda, versão simulada à direita. */
function PairRow({
  real,
  simulated,
}: {
  real: React.ReactNode;
  simulated: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 items-start lg:grid-cols-2">
      <div className="min-w-0 space-y-2.5">{real}</div>
      <div className="min-w-0 space-y-2.5">{simulated}</div>
    </div>
  );
}

export default function Metas() {
  const navigate = useNavigate();
  const { isPersonal } = useCompany();
  const { goals, loading, createGoal, updateGoal } = useGoals();
  const stats = useMetasSidebarStats();

  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<{
    name: string;
    target: number;
    deadline?: string;
    monthly?: number;
  } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [expenseCuts, setExpenseCuts] = useState<Record<string, number>>({});
  const [incomeBoosts, setIncomeBoosts] = useState<Record<string, number>>({});
  const [selectedIncome, setSelectedIncome] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);

  // Cada simulador nasce aberto na maior categoria da sua lista.
  useEffect(() => {
    if (stats.loading) return;
    setSelectedIncome((cur) => cur ?? stats.incomeCategories[0]?.name ?? null);
    setSelectedExpense((cur) => cur ?? stats.expenseCategories[0]?.name ?? null);
  }, [stats.loading, stats.incomeCategories, stats.expenseCategories]);

  const selectedIncomeCat =
    stats.incomeCategories.find((c) => c.name === selectedIncome) ?? null;
  const selectedExpenseCat =
    stats.expenseCategories.find((c) => c.name === selectedExpense) ?? null;
  const totalIncomeSimulated = sumSimulated(stats.incomeCategories, incomeBoosts);
  const totalExpenseSimulated = sumSimulated(stats.expenseCategories, expenseCuts);

  // Base única para real e simulado (pode ser negativa quando as saídas superam as entradas).
  const monthlyCapacityRaw = stats.avgIncomeMonth - stats.avgSpentMonth;
  const monthlyCapacity = Math.max(0, monthlyCapacityRaw);

  const simulatedIncome = stats.avgIncomeMonth + totalIncomeSimulated;
  const simulatedExpense = Math.max(0, stats.avgSpentMonth - totalExpenseSimulated);
  const simulatedCapacity = simulatedIncome - simulatedExpense;
  const monthsRemaining = Math.max(0, 12 - (new Date().getMonth() + 1));
  const simulatedLeftover =
    stats.leftover + (simulatedCapacity - monthlyCapacityRaw) * monthsRemaining;

  const { activeGoalId, setActiveGoalId, activeGoal } = useActiveGoal(goals);
  const {
    planningGoal,
    scoreResult,
    actionPlan,
    isSimulated,
    dispatchResolution,
    patchGoal,
    addAiActions,
    resetScenario,
  } = usePlanningGoal({
    goal: activeGoal,
    monthlyCapacity,
    topCategories: stats.topCategories,
  });

  const openCreate = (suggestion?: { name: string; target: number }) => {
    setPrefill(suggestion || null);
    setFormOpen(true);
  };

  const buildContext = useCallback(
    (history: ChatMessage[]): GoalPlanningContext => ({
      goal: planningGoal,
      scoreResult,
      financialStats: {
        totalBalance: stats.totalBalance,
        avgIncomeMonth: stats.avgIncomeMonth,
        avgSpentMonth: stats.avgSpentMonth,
        monthlyCapacity,
      },
      topCategories: stats.topCategories,
      conversationHistory: history,
    }),
    [planningGoal, scoreResult, stats, monthlyCapacity],
  );

  const handleReply = useCallback(
    (reply: AssistantReply) => {
      if (reply.goalPatch) patchGoal(reply.goalPatch);
      reply.resolutionActions?.forEach(dispatchResolution);
      if (reply.actions) addAiActions(reply.actions);
    },
    [patchGoal, dispatchResolution, addAiActions],
  );

  const deficit = useMemo(() => {
    const gap = scoreResult?.breakdown.capacityGap ?? 0;
    return Math.max(0, -gap);
  }, [scoreResult]);

  const showResolution = Boolean(scoreResult && needsResolution(scoreResult.status));

  return (
    <div className="metas-scope animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display text-foreground">
            Planejamento Inteligente
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isPersonal ? "Pessoal" : "Empresa"} · cofrinhos e metas
          </p>
        </div>
        <Button
          onClick={() => openCreate()}
          size="icon"
          className="h-11 w-11 rounded-full shrink-0"
          aria-label="Nova meta"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Real x simulado, pareados linha a linha */}
      {stats.loading ? (
        <OverviewSkeleton />
      ) : (
        <div className="space-y-3">
          <PairRow
            real={
              <>
                <OverviewHeader />
                <RealBalanceCard value={stats.totalBalance} />
              </>
            }
            simulated={
              <div className="px-1">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Simulação
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ajuste ao lado e compare com o real
                </p>
              </div>
            }
          />

          <PairRow
            real={
              <RealAverageBlock
                kind="income"
                stats={stats}
                simulated={incomeBoosts}
                selected={selectedIncome}
                onSelect={setSelectedIncome}
              />
            }
            simulated={
              <>
                <OverviewDetailPanel
                  mode="income"
                  category={selectedIncomeCat}
                  percent={selectedIncomeCat ? incomeBoosts[selectedIncomeCat.name] ?? 0 : 0}
                  totalSimulatedMonthly={totalIncomeSimulated}
                  newAverage={simulatedIncome}
                  onPercentChange={(p) => {
                    if (!selectedIncomeCat) return;
                    setIncomeBoosts((prev) => ({ ...prev, [selectedIncomeCat.name]: p }));
                  }}
                  onReset={() => setIncomeBoosts({})}
                />
                <SimulatedCategoryList
                  items={stats.incomeCategories}
                  percents={incomeBoosts}
                  kind="income"
                  selected={selectedIncome}
                  onSelect={setSelectedIncome}
                />
              </>
            }
          />

          <PairRow
            real={
              <RealAverageBlock
                kind="expense"
                stats={stats}
                simulated={expenseCuts}
                selected={selectedExpense}
                onSelect={setSelectedExpense}
              />
            }
            simulated={
              <>
                <OverviewDetailPanel
                  mode="expense"
                  category={selectedExpenseCat}
                  percent={selectedExpenseCat ? expenseCuts[selectedExpenseCat.name] ?? 0 : 0}
                  totalSimulatedMonthly={totalExpenseSimulated}
                  newAverage={simulatedExpense}
                  onPercentChange={(p) => {
                    if (!selectedExpenseCat) return;
                    setExpenseCuts((prev) => ({ ...prev, [selectedExpenseCat.name]: p }));
                  }}
                  onReset={() => setExpenseCuts({})}
                />
                <SimulatedCategoryList
                  items={stats.expenseCategories}
                  percents={expenseCuts}
                  kind="expense"
                  selected={selectedExpense}
                  onSelect={setSelectedExpense}
                />
              </>
            }
          />

          <PairRow
            real={
              <>
                <RealCapacityCard value={monthlyCapacityRaw} />
                <RealLeftoverCard value={stats.leftover} />
              </>
            }
            simulated={
              <SimulationSummary
                baseCapacity={monthlyCapacityRaw}
                simulatedCapacity={simulatedCapacity}
                baseLeftover={stats.leftover}
                simulatedLeftover={simulatedLeftover}
                simulatedGain={totalIncomeSimulated}
                simulatedSaving={totalExpenseSimulated}
                onCreateGoal={(draft) => {
                  setPrefill(draft);
                  setFormOpen(true);
                }}
              />
            }
          />
        </div>
      )}

      {/* Cofrinhos e plano */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-[1.5rem]" />
            ))}
          </div>
        ) : goals.length === 0 ? null : (
          <>
            <div className="grid gap-4 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-4">
                {planningGoal && scoreResult && (
                  <ActiveGoalCard
                    goal={planningGoal}
                    scoreResult={scoreResult}
                    isSimulated={isSimulated}
                  />
                )}
                <GoalChat
                  service={assistantService}
                  buildContext={buildContext}
                  onReply={handleReply}
                  suggestions={CHAT_CHIPS}
                  disabled={!planningGoal}
                />
                <GoalSelectorList
                  goals={goals}
                  activeGoalId={activeGoalId}
                  onSelect={setActiveGoalId}
                  onOpen={(g: Goal) => navigate(`/metas/${g.id}`)}
                  onCreate={() => openCreate()}
                />
                {!planningGoal && (
                  <div className="glass-card p-5">
                    <p className="text-sm text-muted-foreground">
                      Selecione um cofrinho para ver progresso, score e plano de ação.
                    </p>
                  </div>
                )}
              </div>

              {planningGoal && scoreResult && (
                <div className={cn("min-w-0 space-y-4")}>
                  <GoalProgressPanel goal={planningGoal} scoreResult={scoreResult} />

                  {showResolution && (
                    <GoalResolutionPanel
                      breakdown={scoreResult.breakdown}
                      topCategories={stats.topCategories}
                      onResolve={dispatchResolution}
                      onCombine={() => setPlanOpen(true)}
                      onReset={resetScenario}
                      isSimulated={isSimulated}
                    />
                  )}

                  <ActionPlanList
                    items={actionPlan}
                    footer={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => setPlanOpen(true)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Ver plano completo
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <GoalFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setPrefill(null);
        }}
        editGoal={
          prefill
            ? ({
                id: "", user_id: "", company_id: null,
                name: prefill.name, target_amount: prefill.target,
                current_amount: 0, deadline: prefill.deadline || null,
                auto_reserve_enabled: Boolean(prefill.monthly), auto_reserve_frequency: null,
                auto_reserve_per_expense: 0, auto_reserve_per_sale: 0,
                auto_reserve_amount: prefill.monthly || 0, icon: "", created_at: "",
              } as Goal)
            : null
        }
        onSave={createGoal}
        onUpdate={updateGoal}
      />

      <ActionPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        gap={deficit > 0 ? deficit : Math.max(0, -(stats.leftover))}
        topCategories={stats.topCategories}
        goalName={planningGoal?.title}
        title="Como tornar essa meta possível"
      />
    </div>
  );
}

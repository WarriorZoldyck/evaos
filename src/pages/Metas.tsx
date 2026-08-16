import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  MetaAverageCard,
  RealizedMonthCard,
  RealCapacityCard,
  RealLeftoverCard,
  OverviewDetailPanel,
  PairedCategoryList,
  SimulationSummary,
  GainTotalCard,
  SavingGoalCard,
  sumSimulated,
} from "@/components/metas/planejamento/FinancialOverview";
import { MonthRiskCard } from "@/components/metas/planejamento/MonthRiskCard";
import { useBudgetTargets } from "@/hooks/useBudgetTargets";


import { cn } from "@/lib/utils";
import { GoalInsightCard } from "@/components/metas/planejamento/GoalInsightCard";

import { CreateGoalFromSimulationDialog } from "@/components/metas/planejamento/CreateGoalFromSimulationDialog";
import { ObjectivesPanel } from "@/components/metas/planejamento/ObjectivesPanel";


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
    <div className="grid gap-2.5 items-start md:grid-cols-2">
      <div className="min-w-0 space-y-2">{real}</div>
      <div className="min-w-0 space-y-2">{simulated}</div>
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
  const [simGoalOpen, setSimGoalOpen] = useState(false);

  const [expenseCuts, setExpenseCuts] = useState<Record<string, number>>({});
  const [incomeBoosts, setIncomeBoosts] = useState<Record<string, number>>({});
  const [selectedIncome, setSelectedIncome] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  // Um bloco aberto por vez, compartilhado pelas duas colunas.
  const [openBlock, setOpenBlock] = useState<"income" | "expense" | null>("expense");

  const openIncome = () => {
    setOpenBlock((cur) => (cur === "income" ? null : "income"));
  };
  const openExpense = () => {
    setOpenBlock((cur) => (cur === "expense" ? null : "expense"));
  };

  // Cada bloco nasce apontando para a maior categoria da sua lista.
  useEffect(() => {
    if (stats.loading) return;
    setSelectedIncome((cur) => cur ?? stats.incomeCategories[0]?.name ?? null);
    setSelectedExpense((cur) => cur ?? stats.expenseCategories[0]?.name ?? null);
  }, [stats.loading, stats.incomeCategories, stats.expenseCategories]);

  // Metas orçamentárias salvas: hidratam os percentuais na abertura da página.
  const budgetTargets = useBudgetTargets();
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || stats.loading || budgetTargets.loading) return;
    hydrated.current = true;

    const toPercents = (
      items: typeof stats.incomeCategories,
      saved: Record<string, number>,
      kind: "income" | "expense",
    ) => {
      const out: Record<string, number> = {};
      items.forEach((c) => {
        const target = saved[c.name];
        if (target === undefined || c.total <= 0) return;
        const pct =
          kind === "income"
            ? ((target - c.total) / c.total) * 100
            : ((c.total - target) / c.total) * 100;
        if (Math.abs(pct) >= 0.01) out[c.name] = Math.round(pct * 100) / 100;
      });
      return out;
    };

    setIncomeBoosts(toPercents(stats.incomeCategories, budgetTargets.income, "income"));
    setExpenseCuts(toPercents(stats.expenseCategories, budgetTargets.expense, "expense"));
  }, [stats.loading, budgetTargets.loading, stats.incomeCategories, stats.expenseCategories, budgetTargets.income, budgetTargets.expense]);

  /** Salva a meta mensal da categoria a partir do percentual simulado. */
  const persistTarget = useCallback(
    (kind: "income" | "expense", name: string, average: number, percent: number) => {
      const delta = (average * percent) / 100;
      const target = Math.max(0, kind === "income" ? average + delta : average - delta);
      budgetTargets.setTarget(kind, name, target);
    },
    [budgetTargets],
  );




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
    <div className="metas-scope animate-fade-in space-y-6 w-full max-w-[1180px] mx-auto">
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

      {/* Nível 1 — Metas Orçamentárias (fluxo de caixa) */}
      <div className="px-1">
        <h2 className="text-sm font-semibold text-foreground">Metas Orçamentárias</h2>
        <p className="text-xs text-muted-foreground">
          Quanto entra e quanto sai por categoria — define a sobra do mês.
        </p>
      </div>

      {stats.loading ? (
        <OverviewSkeleton />
      ) : (
        <div className="grid gap-2.5 items-start md:grid-cols-[minmax(0,1fr)_minmax(180px,210px)]">
          <div className="min-w-0 space-y-2.5">
            <PairRow
              real={
                <>
                  <OverviewHeader />
                  <RealBalanceCard value={stats.totalBalance} />
                </>
              }
              simulated={null}
            />

            <PairRow
              real={
                <RealAverageBlock
                  kind="income"
                  stats={stats}
                  onToggle={openIncome}
                />
              }
              simulated={
                <>
                  <button type="button" onClick={openIncome} className="w-full text-left">
                    <MetaAverageCard
                      kind="income"
                      value={simulatedIncome}
                      base={stats.avgIncomeMonth}
                    />
                  </button>
                  <RealizedMonthCard
                    kind="income"
                    actual={stats.incomeMonth}
                    target={simulatedIncome}
                  />
                </>
              }
            />


            {openBlock === "income" && (
              <PairedCategoryList
                items={stats.incomeCategories}
                percents={incomeBoosts}
                kind="income"
                selected={selectedIncome}
                onSelect={setSelectedIncome}
              />
            )}

            <PairRow
              real={
                <RealAverageBlock
                  kind="expense"
                  stats={stats}
                  onToggle={openExpense}
                />
              }
              simulated={
                <>
                  <button type="button" onClick={openExpense} className="w-full text-left">
                    <MetaAverageCard
                      kind="expense"
                      value={simulatedExpense}
                      base={stats.avgSpentMonth}
                    />
                  </button>
                  <RealizedMonthCard
                    kind="expense"
                    actual={stats.spentMonth}
                    target={simulatedExpense}
                  />
                </>
              }
            />

            {openBlock === "expense" && (
              <PairedCategoryList
                items={stats.expenseCategories}
                percents={expenseCuts}
                kind="expense"
                selected={selectedExpense}
                onSelect={setSelectedExpense}
              />
            )}


            <PairRow
              real={
                <>
                  <RealCapacityCard value={monthlyCapacityRaw} />
                  <RealLeftoverCard value={stats.leftover} />
                </>
              }
              simulated={
                <>
                  <SimulationSummary
                    baseCapacity={monthlyCapacityRaw}
                    simulatedCapacity={simulatedCapacity}
                    baseLeftover={stats.leftover}
                    simulatedLeftover={simulatedLeftover}
                  />
                  <Button
                    className="w-full gap-1.5"
                    onClick={() => setSimGoalOpen(true)}
                    disabled={simulatedCapacity <= 0}
                  >
                    <Sparkles className="h-4 w-4" />
                    Usar o que vai sobrar
                  </Button>
                </>
              }
            />
          </div>

          <aside className="min-w-0 space-y-3 md:sticky md:top-4">
            <GainTotalCard
              monthly={totalIncomeSimulated}
              items={stats.incomeCategories}
              percents={incomeBoosts}
            />
            <SavingGoalCard
              monthly={totalExpenseSimulated}
              items={stats.expenseCategories}
              percents={expenseCuts}
            />
            {openBlock === "income" && (
              <OverviewDetailPanel
                mode="income"
                category={selectedIncomeCat}
                percent={selectedIncomeCat ? incomeBoosts[selectedIncomeCat.name] ?? 0 : 0}
                newAverage={simulatedIncome}
                onPercentChange={(p) => {
                  if (!selectedIncomeCat) return;
                  setIncomeBoosts((prev) => ({ ...prev, [selectedIncomeCat.name]: p }));
                  persistTarget("income", selectedIncomeCat.name, selectedIncomeCat.total, p);
                }}
                onReset={() => {
                  setIncomeBoosts({});
                  budgetTargets.clearKind("income");
                }}
              />
            )}

            {openBlock === "expense" && (
              <OverviewDetailPanel
                mode="expense"
                category={selectedExpenseCat}
                percent={selectedExpenseCat ? expenseCuts[selectedExpenseCat.name] ?? 0 : 0}
                newAverage={simulatedExpense}
                onPercentChange={(p) => {
                  if (!selectedExpenseCat) return;
                  setExpenseCuts((prev) => ({ ...prev, [selectedExpenseCat.name]: p }));
                  persistTarget("expense", selectedExpenseCat.name, selectedExpenseCat.total, p);
                }}
                onReset={() => {
                  setExpenseCuts({});
                  budgetTargets.clearKind("expense");
                }}
              />
            )}

            <MonthRiskCard
              expenseCategories={stats.expenseCategories}
              percents={expenseCuts}
              onSelect={(name) => {
                setOpenBlock("expense");
                setSelectedExpense(name);
              }}
            />

            <GoalInsightCard
              goals={goals}
              activeGoalId={activeGoalId}
              monthlyCapacity={Math.max(0, simulatedCapacity)}
            />
          </aside>

        </div>
      )}


      {/* Nível 2 — Objetivos (destino da sobra) */}
      {!loading && (
        <ObjectivesPanel
          goals={goals}
          leftoverMonthly={Math.max(0, simulatedCapacity)}
          activeGoalId={activeGoalId}
          onSelect={setActiveGoalId}
          onOpenGoal={(id) => navigate(`/metas/${id}`)}
          onCreate={() => openCreate()}
        />
      )}

      {/* Acompanhamento do objetivo selecionado */}
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
        editGoal={null}
        prefill={
          prefill
            ? {
                name: prefill.name,
                target_amount: prefill.target,
                deadline: prefill.deadline || null,
                auto_reserve_amount: prefill.monthly || 0,
              }
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

      <CreateGoalFromSimulationDialog
        open={simGoalOpen}
        onOpenChange={setSimGoalOpen}
        simulatedGain={totalIncomeSimulated}
        simulatedSaving={totalExpenseSimulated}
        baseCapacity={monthlyCapacityRaw}
        simulatedCapacity={simulatedCapacity}
        baseLeftover={stats.leftover}
        simulatedLeftover={simulatedLeftover}
        goals={goals}
        onCreate={(draft) => createGoal(draft)}
      />

    </div>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

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
  realized,
}: {
  real: React.ReactNode;
  simulated: React.ReactNode;
  realized?: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-5 gap-y-3 items-stretch md:grid-cols-[1fr_1fr_1.1fr]">
      <div className="min-w-0 space-y-3">{real}</div>
      <div className="min-w-0 space-y-3">{simulated}</div>
      <div className="min-w-0 space-y-3">{realized}</div>
    </div>
  );
}



export default function Metas() {
  const navigate = useNavigate();
  const { isPersonal, selectedCompanyId } = useCompany();
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals();
  const stats = useMetasSidebarStats();

  /** Chave de UI por contexto: o que estava aberto/selecionado volta igual. */
  const uiKey = `metas:ui:${isPersonal ? "personal" : selectedCompanyId ?? "none"}`;
  const readUi = () => {
    try {
      return JSON.parse(localStorage.getItem(uiKey) || "{}") as {
        openBlock?: "income" | "expense" | null;
        selectedIncome?: string | null;
        selectedExpense?: string | null;
      };
    } catch {
      return {};
    }
  };

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

  const gridRef = useRef<HTMLDivElement>(null);

  // Clicar fora (ou Esc) fecha a lista de categorias e devolve a visão compacta.
  // O ref envolve as duas colunas (planejamento + aside com sliders) para que
  // interagir com os controles de meta não feche as categorias.
  useEffect(() => {
    if (!openBlock) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = gridRef.current;
      if (el && !el.contains(e.target as Node)) setOpenBlock(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenBlock(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openBlock]);

  const openIncome = () => {
    setOpenBlock((cur) => (cur === "income" ? null : "income"));
  };
  const openExpense = () => {
    setOpenBlock((cur) => (cur === "expense" ? null : "expense"));
  };

  // Restaura a UI salva ao trocar de contexto.
  useEffect(() => {
    const saved = readUi();
    setOpenBlock(saved.openBlock ?? "expense");
    setSelectedIncome(saved.selectedIncome ?? null);
    setSelectedExpense(saved.selectedExpense ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        uiKey,
        JSON.stringify({ openBlock, selectedIncome, selectedExpense }),
      );
    } catch {
      /* storage indisponível: a UI só perde a última posição */
    }
  }, [uiKey, openBlock, selectedIncome, selectedExpense]);

  // Cada bloco nasce apontando para a maior categoria da sua lista.
  useEffect(() => {
    if (stats.loading) return;
    setSelectedIncome((cur) => cur ?? stats.incomeCategories[0]?.name ?? null);
    setSelectedExpense((cur) => cur ?? stats.expenseCategories[0]?.name ?? null);
  }, [stats.loading, stats.incomeCategories, stats.expenseCategories]);

  // Metas orçamentárias salvas: hidratam os percentuais na abertura da página.
  const budgetTargets = useBudgetTargets();
  const hydratedKey = useRef<string | null>(null);
  useEffect(() => {
    const hasCategories =
      stats.incomeCategories.length > 0 || stats.expenseCategories.length > 0;
    if (
      hydratedKey.current === uiKey ||
      stats.loading ||
      budgetTargets.loading ||
      !hasCategories
    ) {
      return;
    }
    hydratedKey.current = uiKey;

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
  }, [uiKey, stats.loading, budgetTargets.loading, stats.incomeCategories, stats.expenseCategories, budgetTargets.income, budgetTargets.expense]);

  /** Salva a meta mensal da categoria a partir do percentual simulado. */
  const persistTarget = useCallback(
    (kind: "income" | "expense", name: string, average: number, percent: number) => {
      const delta = (average * percent) / 100;
      const target = Math.max(0, kind === "income" ? average + delta : average - delta);
      budgetTargets.setTarget(kind, name, target);
    },
    [budgetTargets],
  );

  // Ao sair da página, grava o que ainda estava no debounce.
  const flushRef = useRef(budgetTargets.flush);
  flushRef.current = budgetTargets.flush;
  useEffect(() => () => { void flushRef.current(); }, []);

  const handleDeleteGoal = useCallback(
    async (id: string) => {
      await deleteGoal(id);
    },
    [deleteGoal],
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
    <div className="metas-scope animate-fade-in space-y-7 w-full max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display text-foreground">
            Planejamento Inteligente
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isPersonal ? "Pessoal" : "Empresa"} · cofrinhos e metas
          </p>
        </div>
      </div>


      {/* Nível 1 — Metas Orçamentárias (fluxo de caixa) */}
      <div className="px-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Metas Orçamentárias</h2>
          <p className="text-xs text-muted-foreground">
            Quanto entra e quanto sai por categoria — define a sobra do mês.
          </p>
        </div>
        <span className="text-[11px] shrink-0 text-muted-foreground">
          {budgetTargets.error
            ? <span className="text-destructive">Falha ao salvar: {budgetTargets.error}</span>
            : budgetTargets.saving
              ? "Salvando…"
              : "Planejamento salvo"}
        </span>
      </div>

      {stats.loading ? (
        <OverviewSkeleton />
      ) : (
        <div className="grid gap-5 items-start md:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">

          <div ref={planningRef} className="min-w-0 space-y-5">

            <OverviewHeader />

            {/* Cabeçalho das colunas */}
            <div className="hidden md:grid gap-x-5 md:grid-cols-[1fr_1fr_1.1fr] px-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              <span className="truncate">Real</span>
              <span className="truncate">Meta / mês</span>
              <span className="truncate">Realizado neste mês</span>
            </div>

            <PairRow
              real={
                <RealAverageBlock
                  kind="income"
                  stats={stats}
                  onToggle={openIncome}
                />
              }
              simulated={
                <button type="button" onClick={openIncome} className="w-full h-full text-left">
                  <MetaAverageCard
                    kind="income"
                    value={simulatedIncome}
                    base={stats.avgIncomeMonth}
                  />
                </button>
              }
              realized={
                <RealizedMonthCard
                  kind="income"
                  actual={stats.incomeMonth}
                  target={simulatedIncome}
                />
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
                <button type="button" onClick={openExpense} className="w-full h-full text-left">
                  <MetaAverageCard
                    kind="expense"
                    value={simulatedExpense}
                    base={stats.avgSpentMonth}
                  />
                </button>
              }
              realized={
                <RealizedMonthCard
                  kind="expense"
                  actual={stats.spentMonth}
                  target={simulatedExpense}
                />
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
                <SimulationSummary
                  baseCapacity={monthlyCapacityRaw}
                  simulatedCapacity={simulatedCapacity}
                  baseLeftover={stats.leftover}
                  simulatedLeftover={simulatedLeftover}
                />
              }
              realized={
                <Button
                  className="w-full gap-1.5"
                  onClick={() => setSimGoalOpen(true)}
                  disabled={simulatedCapacity <= 0}
                >
                  <Sparkles className="h-4 w-4" />
                  Usar o que vai sobrar
                </Button>
              }
            />
          </div>


          <aside className="min-w-0 space-y-4 md:sticky md:top-4">
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

          </aside>

        </div>
      )}


      {/* Nível 2 — Objetivos (destino da sobra) + leitura da EVA */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[1.5rem]" />
            ))}
          </div>
        ) : (
          <ObjectivesPanel
            goals={goals}
            leftoverMonthly={Math.max(0, simulatedCapacity)}
            activeGoalId={activeGoalId}
            onSelect={setActiveGoalId}
            onOpenGoal={(id) => navigate(`/metas/${id}`)}
            onEditGoal={(id) => navigate(`/metas/${id}?editar=1`)}
            onDeleteGoal={handleDeleteGoal}
            onCreate={() => openCreate()}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <GoalInsightCard
            goals={goals}
            activeGoalId={activeGoalId}
            monthlyCapacity={Math.max(0, simulatedCapacity)}
          />

          <MonthRiskCard
            expenseCategories={stats.expenseCategories}
            percents={expenseCuts}
            onSelect={(name) => {
              setOpenBlock("expense");
              setSelectedExpense(name);
            }}
          />
        </div>
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

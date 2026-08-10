import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Plus, Sparkles, Plane, Wrench } from "lucide-react";

import { useGoals, type Goal } from "@/hooks/useGoals";
import { useCompany } from "@/contexts/CompanyContext";
import { useMetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { useActiveGoal } from "@/hooks/useActiveGoal";
import { usePlanningGoal } from "@/hooks/usePlanningGoal";

import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { ActionPlanDialog } from "@/components/metas/ActionPlanDialog";
import { FinancialOverview } from "@/components/metas/planejamento/FinancialOverview";
import { ActiveGoalCard } from "@/components/metas/planejamento/ActiveGoalCard";
import { GoalChat } from "@/components/metas/planejamento/GoalChat";
import { GoalSelectorList } from "@/components/metas/planejamento/GoalSelectorList";
import { GoalProgressPanel } from "@/components/metas/planejamento/GoalProgressPanel";
import { ActionPlanList } from "@/components/metas/planejamento/ActionPlanList";
import { GoalResolutionPanel } from "@/components/metas/planejamento/GoalResolutionPanel";
import { InstallmentCalculator } from "@/components/metas/planejamento/InstallmentCalculator";

import { needsResolution, formatBRL } from "@/lib/goalPlanning";
import { LocalAssistantService } from "@/services/assistant/LocalAssistantService";
import type {
  AssistantReply,
  ChatMessage,
  GoalPlanningContext,
} from "@/services/assistant/AssistantService";

const SUGGESTIONS = [
  { icon: Sparkles, name: "Reserva de emergência", target: 10000 },
  { icon: Plane, name: "Viagem dos sonhos", target: 5000 },
  { icon: Wrench, name: "Troca de equipamento", target: 3000 },
];

const CHAT_CHIPS = ["Até 6 meses", "1 ano", "2 anos", "Consigo guardar R$ 800 por mês"];

// Injeção da implementação temporária — a UI conhece apenas a interface.
const assistantService = new LocalAssistantService();

export default function Metas() {
  const navigate = useNavigate();
  const { isPersonal } = useCompany();
  const { goals, loading, createGoal, updateGoal } = useGoals();
  const stats = useMetasSidebarStats();

  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; target: number } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const monthlyCapacity = Math.max(0, stats.avgIncomeMonth - stats.avgSpentMonth);

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

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_340px] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Coluna esquerda */}
        <div className="min-w-0 space-y-4">
          <FinancialOverview stats={stats} monthlyCapacity={monthlyCapacity} />
          <InstallmentCalculator />
        </div>

        {/* Centro */}
        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-[1.5rem]" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <EmptyState onPick={openCreate} />
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Coluna direita */}
        <div className="min-w-0 space-y-4 xl:col-auto lg:col-span-2 xl:col-span-1">
          {planningGoal && scoreResult ? (
            <>
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
            </>
          ) : (
            !loading && (
              <div className="glass-card p-5">
                <p className="text-sm text-muted-foreground">
                  Crie um cofrinho para ver progresso, score e plano de ação.
                </p>
              </div>
            )
          )}
        </div>
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
                current_amount: 0, deadline: null,
                auto_reserve_enabled: false, auto_reserve_frequency: null,
                auto_reserve_per_expense: 0, auto_reserve_per_sale: 0,
                auto_reserve_amount: 0, icon: "", created_at: "",
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

function EmptyState({ onPick }: { onPick: (s: { name: string; target: number }) => void }) {
  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <LifeBuoy className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold mb-1">Nenhum cofrinho ainda</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Crie seu primeiro cofrinho para a EVA montar o plano com os seus números reais.
        </p>
      </div>

      <div className="divide-y divide-border/60">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.name}
            onClick={() => onPick({ name: s.name, target: s.target })}
            className="w-full flex items-center gap-4 py-3 text-left hover:bg-accent/40 transition-colors rounded-lg px-1"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm">{s.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sugestão: {formatBRL(s.target)}
              </p>
            </div>
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

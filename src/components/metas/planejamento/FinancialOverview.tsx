import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank, ChevronDown, Sparkles, RotateCcw, X,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import type { CategoryBreakdown, MetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { FinancialMetricCard } from "./FinancialMetricCard";
import { formatBRL } from "@/lib/goalPlanning";
import { deadlineFromMonths } from "@/lib/savingsSimulator";
import { cn } from "@/lib/utils";

export type OverviewExpanded = "income" | "expense" | null;
export type SimulationKind = "income" | "expense";

export interface SelectedCategory {
  kind: SimulationKind;
  name: string;
}

export interface GoalDraft {
  name: string;
  target: number;
  deadline: string;
  monthly: number;
}

const PLAN_MONTHS = 12;

interface Props {
  stats: MetasSidebarStats;
  monthlyCapacity: number;
  expanded: OverviewExpanded;
  onToggle: (which: Exclude<OverviewExpanded, null>) => void;
  /** Percentual de corte simulado por categoria de saída. */
  expenseCuts: Record<string, number>;
  /** Percentual de aumento simulado por categoria de entrada. */
  incomeBoosts: Record<string, number>;
  selected: SelectedCategory | null;
  onSelectCategory: (kind: SimulationKind, name: string) => void;
  onClear: (kind: SimulationKind) => void;
  /** Reporta o offsetTop (px) do card ativo para alinhar o painel lateral. */
  onAnchorChange?: (top: number | null) => void;
}

export function FinancialOverview({
  stats,
  monthlyCapacity,
  expanded,
  onToggle,
  expenseCuts,
  incomeBoosts,
  selected,
  onSelectCategory,
  onClear,
  onAnchorChange,
}: Props) {
  const { isPersonal } = useCompany();
  const rootRef = useRef<HTMLDivElement>(null);
  const incomeRef = useRef<HTMLDivElement>(null);
  const expenseRef = useRef<HTMLDivElement>(null);

  const totalIncomeBoost = sumSimulated(stats.incomeCategories, incomeBoosts);
  const totalExpenseSaving = sumSimulated(stats.expenseCategories, expenseCuts);

  useEffect(() => {
    if (!onAnchorChange) return;
    if (!selected) {
      onAnchorChange(null);
      return;
    }
    const el = selected.kind === "income" ? incomeRef.current : expenseRef.current;
    const root = rootRef.current;
    if (!el || !root) {
      onAnchorChange(null);
      return;
    }
    onAnchorChange(el.getBoundingClientRect().top - root.getBoundingClientRect().top);
  }, [selected, expanded, onAnchorChange, stats.loading, stats.incomeCategories, stats.expenseCategories]);

  if (stats.loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[1.5rem]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={rootRef}>
      <div className="px-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Visão do contexto
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPersonal ? "Pessoal" : "Empresa"}
        </p>
      </div>

      <FinancialMetricCard
        icon={<Wallet className="h-4 w-4" />}
        label="Saldo total"
        value={formatBRL(stats.totalBalance)}
        tone="primary"
      />

      <div ref={incomeRef}>
        <FinancialMetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Média de entradas / mês"
          value={formatBRL(stats.avgIncomeMonth)}
          tone="success"
          interactive
          active={expanded === "income"}
          onClick={() => onToggle("income")}
          rightSlot={
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded === "income" && "rotate-180",
              )}
            />
          }
        />
      </div>

      {expanded === "income" && (
        <CategoryList
          items={stats.incomeCategories}
          emptyLabel="Sem receitas categorizadas neste ano."
          barClass="bg-emerald-500/70"
          hint="Clique numa categoria para simular um aumento."
          simulated={incomeBoosts}
          simulatedLabel={(pct, value) => `aumento de ${pct}% · + ${formatBRL(value)}/mês`}
          selected={selected?.kind === "income" ? selected.name : null}
          onSelect={(name) => onSelectCategory("income", name)}
          totalSimulated={totalIncomeBoost}
          totalLabel="Ganho total simulado"
          onClearAll={() => onClear("income")}
        />
      )}

      <div ref={expenseRef}>
        <FinancialMetricCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Média de saídas / mês"
          value={formatBRL(stats.avgSpentMonth)}
          interactive
          active={expanded === "expense"}
          onClick={() => onToggle("expense")}
          rightSlot={
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded === "expense" && "rotate-180",
              )}
            />
          }
        />
      </div>

      {expanded === "expense" && (
        <CategoryList
          items={stats.expenseCategories}
          emptyLabel="Sem despesas categorizadas neste ano."
          barClass="bg-primary/70"
          hint="Clique numa categoria para simular um corte."
          simulated={expenseCuts}
          simulatedLabel={(pct, value) => `corte de ${pct}% · + ${formatBRL(value)}/mês`}
          selected={selected?.kind === "expense" ? selected.name : null}
          onSelect={(name) => onSelectCategory("expense", name)}
          totalSimulated={totalExpenseSaving}
          totalLabel="Economia total simulada"
          onClearAll={() => onClear("expense")}
        />
      )}

      <FinancialMetricCard
        icon={<PiggyBank className="h-4 w-4" />}
        label="Capacidade mensal estimada"
        value={formatBRL(monthlyCapacity)}
        tone={monthlyCapacity <= 0 ? "danger" : "success"}
      />

      <FinancialMetricCard
        icon={<PiggyBank className="h-4 w-4" />}
        label="Sobra estimada até dez"
        value={formatBRL(stats.leftover)}
        tone={stats.leftover < 0 ? "danger" : "default"}
      />
    </div>
  );
}

export function sumSimulated(
  items: CategoryBreakdown[],
  percents: Record<string, number>,
): number {
  return items.reduce((sum, c) => sum + (c.total * (percents[c.name] ?? 0)) / 100, 0);
}

/** Painel lateral: simulador de corte (saídas) ou de aumento (entradas). */
export function OverviewDetailPanel({
  mode,
  category,
  percent,
  totalSimulatedMonthly,
  onPercentChange,
  onReset,
  onClose,
  onCreateGoal,
}: {
  mode: SimulationKind;
  category: CategoryBreakdown;
  percent: number;
  /** Soma da simulação de todas as categorias do mesmo tipo. */
  totalSimulatedMonthly: number;
  onPercentChange: (percent: number) => void;
  onReset: () => void;
  onClose: () => void;
  onCreateGoal?: (draft: GoalDraft) => void;
}) {
  const isIncome = mode === "income";
  const original = category.total;
  const delta = useMemo(
    () => Math.round(original * (percent / 100) * 100) / 100,
    [original, percent],
  );
  const projected = isIncome ? original + delta : Math.max(0, original - delta);
  const target = Math.round(totalSimulatedMonthly * PLAN_MONTHS * 100) / 100;

  // Rascunho local: o campo só é convertido em percentual no blur/Enter,
  // caso contrário cada tecla digitada reescreveria o valor.
  const [draft, setDraft] = useState<string>(String(Math.round(projected * 100) / 100));
  useEffect(() => {
    setDraft(String(Math.round(projected * 100) / 100));
  }, [projected]);

  const commitDraft = () => {
    if (original <= 0) return;
    const v = Number(draft.replace(",", "."));
    if (draft.trim() === "" || !Number.isFinite(v)) {
      setDraft(String(Math.round(projected * 100) / 100));
      return;
    }
    const clamped = isIncome
      ? Math.min(original * 2, Math.max(original, v))
      : Math.min(original, Math.max(0, v));
    const raw = isIncome
      ? ((clamped - original) / original) * 100
      : ((original - clamped) / original) * 100;
    onPercentChange(Math.min(100, Math.max(0, Math.round(raw * 100) / 100)));
  };


  return (
    <div className="animate-in fade-in slide-in-from-left-1 duration-200 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isIncome ? "Simulador de ganhos" : "Simulador de economia"}
        </h3>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Fechar simulador"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground truncate">{category.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Média atual · <span className="font-mono">{formatBRL(original)}/mês</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isIncome ? "Quanto quer aumentar" : "Quanto quer cortar"}
            </span>
            <span className="font-mono font-semibold text-foreground">{Math.round(percent)}%</span>
          </div>
          <Slider
            value={[percent]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onPercentChange(v)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">
              {isIncome ? "Novo faturamento alvo" : "Novo gasto alvo"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={isIncome ? original : 0}
              max={isIncome ? original * 2 : original}
              step={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="flex-1 h-8 rounded-lg bg-background/60 border border-border px-2 text-xs font-mono text-foreground"
            />

          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            {isIncome ? "Ganho total simulado" : "Economia total simulada"}
          </p>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatBRL(totalSimulatedMonthly)}<span className="text-xs font-normal">/mês</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatBRL(totalSimulatedMonthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses
          </p>
          <div className="pt-1.5 mt-1 border-t border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">
                {isIncome ? "Ganho nesta categoria" : "Economia nesta categoria"}
              </span>
              <span className="font-mono text-foreground">{formatBRL(delta)}/mês</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isIncome ? "Nova média da categoria" : "Sobra na categoria"}</span>
              <span className="font-mono">{formatBRL(projected)}/mês</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
            disabled={totalSimulatedMonthly <= 0}
            onClick={() =>
              onCreateGoal?.({
                name: isIncome
                  ? `Aumentar ${category.name}`
                  : `Economia em ${category.name}`,
                target,
                deadline: deadlineFromMonths(PLAN_MONTHS),
                monthly: Math.round(totalSimulatedMonthly * 100) / 100,
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isIncome ? "Criar meta de ganhos" : "Criar meta com essa economia"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            aria-label="Limpar simulação"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryList({
  items,
  emptyLabel,
  barClass,
  hint,
  simulated,
  simulatedLabel,
  selected,
  onSelect,
  totalSimulated,
  totalLabel,
  onClearAll,
}: {
  items: CategoryBreakdown[];
  emptyLabel: string;
  barClass: string;
  hint?: string;
  simulated: Record<string, number>;
  simulatedLabel: (percent: number, value: number) => string;
  selected: string | null;
  onSelect: (name: string) => void;
  totalSimulated: number;
  totalLabel: string;
  onClearAll: () => void;
}) {
  const total = items.reduce((s, c) => s + c.total, 0);
  return (
    <div className="glass-card p-4 space-y-2">
      {hint && items.length > 0 && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">{emptyLabel}</p>
      ) : (
        <>
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {items.map((c) => {
              const pct = total > 0 ? (c.total / total) * 100 : 0;
              const sim = simulated[c.name] ?? 0;
              const isSelected = selected === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onSelect(c.name)}
                  className={cn(
                    "w-full text-left rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/30",
                    isSelected && "bg-accent/40 ring-1 ring-primary/40",
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                      <span className="font-mono text-muted-foreground shrink-0">
                        {formatBRL(c.total)}/mês
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
                    </div>
                    {sim > 0 && (
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        {simulatedLabel(sim, (c.total * sim) / 100)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {totalSimulated > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground truncate">
                  {totalLabel}
                </p>
                <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatBRL(totalSimulated)}<span className="text-[10px] font-normal">/mês</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBRL(totalSimulated * PLAN_MONTHS)} em {PLAN_MONTHS} meses
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] shrink-0"
                onClick={onClearAll}
              >
                Limpar tudo
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

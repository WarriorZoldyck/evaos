import { useMemo } from "react";
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
  cuts: Record<string, number>;
  selectedCategory: string | null;
  onSelectCategory: (name: string) => void;
}

export function FinancialOverview({
  stats,
  monthlyCapacity,
  expanded,
  onToggle,
  cuts,
  selectedCategory,
  onSelectCategory,
}: Props) {
  const { isPersonal } = useCompany();

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
    <div className="space-y-3">
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

      {expanded === "income" && (
        <CategoryList
          items={stats.incomeCategories}
          emptyLabel="Sem receitas categorizadas neste ano."
          barClass="bg-emerald-500/70"
        />
      )}

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

      {expanded === "expense" && (
        <CategoryList
          items={stats.expenseCategories}
          emptyLabel="Sem despesas categorizadas neste ano."
          barClass="bg-primary/70"
          hint="Clique numa categoria para simular um corte."
          cuts={cuts}
          selected={selectedCategory}
          onSelect={onSelectCategory}
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

/** Painel lateral: simulador de economia da categoria selecionada. */
export function OverviewDetailPanel({
  category,
  percent,
  totalSimulatedMonthly,
  onPercentChange,
  onReset,
  onClose,
  onCreateGoal,
}: {
  category: CategoryBreakdown;
  percent: number;
  /** Soma da economia simulada de todas as categorias. */
  totalSimulatedMonthly: number;
  onPercentChange: (percent: number) => void;
  onReset: () => void;
  onClose: () => void;
  onCreateGoal?: (draft: GoalDraft) => void;
}) {
  const original = category.total;
  const saving = useMemo(
    () => Math.round(original * (percent / 100) * 100) / 100,
    [original, percent],
  );
  const remaining = Math.max(0, original - saving);
  const target = Math.round(totalSimulatedMonthly * PLAN_MONTHS * 100) / 100;

  return (
    <div className="animate-in fade-in slide-in-from-left-1 duration-200 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Simulador de economia
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
            <span className="text-muted-foreground">Quanto quer cortar</span>
            <span className="font-mono font-semibold text-foreground">{percent}%</span>
          </div>
          <Slider
            value={[percent]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onPercentChange(v)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Novo gasto alvo</span>
            <input
              type="number"
              min={0}
              max={original}
              step={10}
              value={Math.round(remaining * 100) / 100}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v) || original <= 0) return;
                const pct = Math.min(100, Math.max(0, ((original - v) / original) * 100));
                onPercentChange(Math.round(pct));
              }}
              className="flex-1 h-8 rounded-lg bg-background/60 border border-border px-2 text-xs font-mono text-foreground"
            />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Economia nesta categoria</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(saving)}/mês
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Sobra na categoria</span>
            <span className="font-mono">{formatBRL(remaining)}/mês</span>
          </div>
          {totalSimulatedMonthly > saving && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
              <span>Total simulado (todas as categorias)</span>
              <span className="font-mono">{formatBRL(totalSimulatedMonthly)}/mês</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {formatBRL(totalSimulatedMonthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
            disabled={totalSimulatedMonthly <= 0}
            onClick={() =>
              onCreateGoal?.({
                name: `Economia em ${category.name}`,
                target,
                deadline: deadlineFromMonths(PLAN_MONTHS),
                monthly: Math.round(totalSimulatedMonthly * 100) / 100,
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            Criar meta com essa economia
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
  cuts,
  selected,
  onSelect,
}: {
  items: CategoryBreakdown[];
  emptyLabel: string;
  barClass: string;
  hint?: string;
  cuts?: Record<string, number>;
  selected?: string | null;
  onSelect?: (name: string) => void;
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
        <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
          {items.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            const cut = cuts?.[c.name] ?? 0;
            const isSelected = selected === c.name;
            const Row = (
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
                {cut > 0 && (
                  <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    corte de {cut}% · + {formatBRL((c.total * cut) / 100)}/mês
                  </p>
                )}
              </div>
            );

            if (!onSelect) return <div key={c.name}>{Row}</div>;

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
                {Row}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

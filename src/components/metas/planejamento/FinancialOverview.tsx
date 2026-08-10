import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank, ChevronDown, Sparkles, RotateCcw,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import type { CategoryBreakdown, MetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { FinancialMetricCard } from "./FinancialMetricCard";
import { formatBRL } from "@/lib/goalPlanning";
import { simulateSavings, deadlineFromMonths } from "@/lib/savingsSimulator";
import { cn } from "@/lib/utils";

type Expanded = "income" | "expense" | null;

export interface GoalDraft {
  name: string;
  target: number;
  deadline: string;
  monthly: number;
}

interface Props {
  stats: MetasSidebarStats;
  monthlyCapacity: number;
  onCreateGoal?: (draft: GoalDraft) => void;
}

const PLAN_MONTHS = 12;

export function FinancialOverview({ stats, monthlyCapacity, onCreateGoal }: Props) {
  const { isPersonal } = useCompany();
  const [expanded, setExpanded] = useState<Expanded>(null);

  const toggle = (which: Exclude<Expanded, null>) =>
    setExpanded((cur) => (cur === which ? null : which));

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
        onClick={() => toggle("income")}
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
        onClick={() => toggle("expense")}
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
        <SavingsPanel items={stats.expenseCategories} onCreateGoal={onCreateGoal} />
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

/** Detalhamento das saídas com simulação de corte por categoria. */
function SavingsPanel({
  items,
  onCreateGoal,
}: {
  items: CategoryBreakdown[];
  onCreateGoal?: (draft: GoalDraft) => void;
}) {
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const [openName, setOpenName] = useState<string | null>(null);

  const result = useMemo(
    () =>
      simulateSavings({
        targetAmount: 0,
        months: PLAN_MONTHS,
        categories: items.map((i) => ({ name: i.name, total: i.total })),
        cuts: Object.entries(cuts).map(([name, percent]) => ({ name, percent })),
      }),
    [items, cuts],
  );

  const totalMonthly = result.lines.reduce((s, l) => s + l.monthlyAvg, 0);
  const hasCuts = result.simulatedMonthly > 0;

  if (items.length === 0) {
    return (
      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground py-2 text-center">
          Sem despesas categorizadas neste ano.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <p className="text-[11px] text-muted-foreground">
        Clique numa categoria e simule quanto quer cortar por mês.
      </p>

      <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
        {result.lines.map((line) => {
          const pct = totalMonthly > 0 ? (line.monthlyAvg / totalMonthly) * 100 : 0;
          const open = openName === line.name;
          return (
            <div key={line.name} className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenName(open ? null : line.name)}
                className="w-full text-left space-y-1 rounded-lg hover:bg-accent/30 transition-colors px-1 py-0.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{line.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {formatBRL(line.monthlyAvg)}/mês
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {open && (
                <div className="px-1 pt-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[line.percent]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) =>
                        setCuts((prev) => ({ ...prev, [line.name]: v }))
                      }
                      className="flex-1"
                    />
                    <span className="w-9 text-right text-xs font-mono text-muted-foreground">
                      {line.percent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      economiza {formatBRL(line.monthlySaving)}/mês
                    </span>
                    <span className="text-muted-foreground font-mono">
                      sobra {formatBRL(line.monthlyAvg - line.monthlySaving)}
                    </span>
                  </div>
                </div>
              )}

              {!open && line.monthlySaving > 0 && (
                <p className="px-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                  corte de {line.percent}% · + {formatBRL(line.monthlySaving)}/mês
                </p>
              )}
            </div>
          );
        })}
      </div>

      {hasCuts && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Economia simulada</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(result.simulatedMonthly)}/mês
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatBRL(result.simulatedMonthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 h-8 text-xs"
              onClick={() =>
                onCreateGoal?.({
                  name: "Meta da economia",
                  target: Math.round(result.simulatedMonthly * PLAN_MONTHS * 100) / 100,
                  deadline: deadlineFromMonths(PLAN_MONTHS),
                  monthly: Math.round(result.simulatedMonthly * 100) / 100,
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
              onClick={() => setCuts({})}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryList({
  items, emptyLabel, barClass,
}: {
  items: CategoryBreakdown[];
  emptyLabel: string;
  barClass: string;
}) {
  const total = items.reduce((s, c) => s + c.total, 0);
  return (
    <div className="glass-card p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">{emptyLabel}</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
          {items.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{c.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {formatBRL(c.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

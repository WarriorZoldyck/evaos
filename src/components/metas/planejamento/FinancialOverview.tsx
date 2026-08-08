import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank, ChevronDown,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import type { CategoryBreakdown, MetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { FinancialMetricCard } from "./FinancialMetricCard";
import { formatBRL } from "@/lib/goalPlanning";
import { cn } from "@/lib/utils";

type Expanded = "income" | "expense" | null;

interface Props {
  stats: MetasSidebarStats;
  monthlyCapacity: number;
}

export function FinancialOverview({ stats, monthlyCapacity }: Props) {
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
        <CategoryList
          items={stats.expenseCategories}
          emptyLabel="Sem despesas categorizadas neste ano."
          barClass="bg-primary/70"
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

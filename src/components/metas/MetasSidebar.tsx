import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank,
  AlertTriangle, Sparkles, ChevronDown,
} from "lucide-react";
import { useMetasSidebarStats, type CategoryBreakdown } from "@/hooks/useMetasSidebarStats";
import { useCompany } from "@/contexts/CompanyContext";
import { ActionPlanDialog } from "./ActionPlanDialog";
import type { Goal } from "@/hooks/useGoals";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MetasSidebarProps {
  goals: Goal[];
}

type Expanded = "income" | "expense" | null;

export function MetasSidebar({ goals }: MetasSidebarProps) {
  const { isPersonal } = useCompany();
  const stats = useMetasSidebarStats();
  const [planOpen, setPlanOpen] = useState(false);
  const [expanded, setExpanded] = useState<Expanded>(null);

  const goalsRemaining = goals.reduce(
    (s, g) => s + Math.max(0, Number(g.target_amount) - Number(g.current_amount)),
    0,
  );
  const gap = Math.max(0, goalsRemaining - stats.leftover);
  const hasDeficit = stats.leftover <= 0 || gap > 0;

  const toggle = (which: Exclude<Expanded, null>) =>
    setExpanded((cur) => (cur === which ? null : which));

  return (
    <aside className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Visão do contexto
        </h2>
        <p className="text-xs text-muted-foreground px-1 mt-0.5">
          {isPersonal ? "Pessoal" : "Empresa"}
        </p>
      </div>

      {stats.loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[1.75rem]" />
          ))}
        </div>
      ) : (
        <>
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Saldo total"
            value={fmt(stats.totalBalance)}
            tone="primary"
          />

          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Média de entradas / mês"
            value={fmt(stats.avgIncomeMonth)}
            tone="success"
            interactive
            active={expanded === "income"}
            onClick={() => toggle("income")}
            rightIcon={
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

          <StatCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Média de saídas / mês"
            value={fmt(stats.avgSpentMonth)}
            interactive
            active={expanded === "expense"}
            onClick={() => toggle("expense")}
            rightIcon={
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

          <StatCard
            icon={<PiggyBank className="h-4 w-4" />}
            label="Sobra estimada até dez"
            value={fmt(stats.leftover)}
            tone={stats.leftover < 0 ? "danger" : "success"}
          />

          {hasDeficit && (
            <div className="neu-card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {stats.leftover < 0 ? "Não vai sobrar" : "Suas metas não cabem na sobra"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Faltam{" "}
                    <strong className="text-destructive">
                      {fmt(Math.max(gap, Math.abs(Math.min(0, stats.leftover))))}
                    </strong>{" "}
                    para fechar o ano com folga.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 border-destructive/40 hover:bg-destructive/10"
                onClick={() => setPlanOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ver plano de ação
              </Button>
            </div>
          )}
        </>
      )}

      <ActionPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        gap={Math.max(gap, Math.abs(Math.min(0, stats.leftover)))}
        topCategories={stats.topCategories}
      />
    </aside>
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
    <div className="neu-card p-4 -mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">{emptyLabel}</p>
      ) : (
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
          {items.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{c.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">{fmt(c.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, tone, interactive, active, onClick, rightIcon,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "primary" | "danger" | "success";
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
  rightIcon?: React.ReactNode;
}) {
  const toneClasses =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";

  const content = (
    <div className="p-5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-semibold min-w-0">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        {rightIcon}
      </div>
      <p className={cn("text-xl font-bold font-mono", toneClasses)}>{value}</p>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "neu-card neu-card-interactive w-full text-left",
          active && "neu-card-active",
        )}
      >
        {content}
      </button>
    );
  }

  return <div className="neu-card">{content}</div>;
}

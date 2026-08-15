import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank, Sparkles, RotateCcw,
} from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext";
import type { CategoryBreakdown, MetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { FinancialMetricCard } from "./FinancialMetricCard";
import { formatBRL } from "@/lib/goalPlanning";
import { deadlineFromMonths } from "@/lib/savingsSimulator";
import { cn } from "@/lib/utils";

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

/** Formata dígitos crus (centavos) como "1.234,56". */
function maskFromDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const units = padded.slice(0, -2);
  return `${units.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

function maskFromNumber(value: number): string {
  return maskFromDigits(String(Math.round((value || 0) * 100)));
}

function numberFromMask(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-[1.5rem]" />
      ))}
    </div>
  );
}

export function OverviewHeader() {
  const { isPersonal } = useCompany();
  return (
    <div className="px-1">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Visão do contexto
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        {isPersonal ? "Pessoal" : "Empresa"} · números reais
      </p>
    </div>
  );
}

export function sumSimulated(
  items: CategoryBreakdown[],
  percents: Record<string, number>,
): number {
  return items.reduce((sum, c) => sum + (c.total * (percents[c.name] ?? 0)) / 100, 0);
}

/** Bloco real: card de média + lista de categorias reais (recolhível). */
export function RealAverageBlock({
  kind,
  stats,
  simulated,
  selected,
  onSelect,
  open,
  onToggle,
}: {
  kind: SimulationKind;
  stats: MetasSidebarStats;
  simulated: Record<string, number>;
  selected: string | null;
  onSelect: (name: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const isIncome = kind === "income";
  return (
    <div className="space-y-2.5">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <FinancialMetricCard
          icon={isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label={isIncome ? "Média de entradas / mês" : "Média de saídas / mês"}
          value={formatBRL(isIncome ? stats.avgIncomeMonth : stats.avgSpentMonth)}
          tone={isIncome ? "success" : "default"}
        />
      </button>
      {open && (
        <CategoryList
          items={isIncome ? stats.incomeCategories : stats.expenseCategories}
          emptyLabel={
            isIncome
              ? "Sem receitas categorizadas neste ano."
              : "Sem despesas categorizadas neste ano."
          }
          barClass={isIncome ? "bg-emerald-500/70" : "bg-primary/70"}
          hint={
            isIncome
              ? "Clique numa categoria para ajustar a meta de entradas."
              : "Clique numa categoria para ajustar a meta de saídas."
          }
          simulated={simulated}
          simulatedLabel={(pct, value) =>
            isIncome
              ? `${pct > 0 ? "aumento" : "redução"} de ${Math.abs(pct)}% · ${value >= 0 ? "+" : "−"} ${formatBRL(Math.abs(value))}/mês`
              : `${pct > 0 ? "corte" : "aumento"} de ${Math.abs(pct)}% · ${value >= 0 ? "+" : "−"} ${formatBRL(Math.abs(value))}/mês`
          }
          selected={selected}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}


/** Painel fixo: ajuste da meta mensal da categoria (para mais ou para menos). */
export function OverviewDetailPanel({
  mode,
  category,
  percent,
  totalSimulatedMonthly,
  newAverage,
  onPercentChange,
  onReset,
}: {
  mode: SimulationKind;
  category: CategoryBreakdown | null;
  percent: number;
  /** Soma da simulação de todas as categorias do mesmo tipo. */
  totalSimulatedMonthly: number;
  /** Nova média mensal do bloco (entradas ou saídas) já simulada. */
  newAverage: number;
  onPercentChange: (percent: number) => void;
  onReset: () => void;
}) {
  const isIncome = mode === "income";
  const original = category?.total ?? 0;
  const delta = useMemo(
    () => Math.round(original * (percent / 100) * 100) / 100,
    [original, percent],
  );
  // Entradas: percentual positivo aumenta. Saídas: percentual positivo corta.
  const projected = Math.max(0, isIncome ? original + delta : original - delta);

  // Campo com máscara de moeda: guardamos centavos como inteiro e formatamos.
  const [draft, setDraft] = useState<string>(() => maskFromNumber(projected));
  useEffect(() => {
    setDraft(maskFromNumber(projected));
  }, [projected]);

  const [pctDraft, setPctDraft] = useState<string>(() => String(Math.round(percent)));
  useEffect(() => {
    setPctDraft(String(Math.round(percent)));
  }, [percent]);

  /** Converte um valor alvo em percentual assinado (aceita mais e menos). */
  const commitTarget = (value: number) => {
    if (original <= 0) return;
    const target = Math.max(0, value);
    const pct = isIncome
      ? ((target - original) / original) * 100
      : ((original - target) / original) * 100;
    onPercentChange(Math.round(pct * 100) / 100);
  };

  const applyMasked = (raw: string) => {
    const masked = maskFromDigits(raw);
    setDraft(masked);
    commitTarget(numberFromMask(masked));
  };

  const applyPercent = (raw: string) => {
    setPctDraft(raw);
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) return;
    onPercentChange(Math.round(value * 100) / 100);
  };

  /** Botões rápidos: mexe no valor alvo em passos de 5% da média. */
  const nudge = (direction: 1 | -1) => {
    if (original <= 0) return;
    const step = Math.max(1, Math.round(original * 0.05 * 100) / 100);
    commitTarget(projected + direction * step);
  };



  const header = (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {isIncome ? "Meta de entradas" : "Meta de saídas"}
      </h3>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2"
        aria-label="Limpar simulação"
        onClick={onReset}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  if (!category) {
    return (
      <div className="space-y-2">
        {header}
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground text-center py-4">
            {isIncome
              ? "Sem receitas categorizadas para simular."
              : "Sem despesas categorizadas para simular."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {header}

      <div className="glass-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{category.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Média atual · <span className="font-mono">{formatBRL(original)}/mês</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-muted-foreground">
              {isIncome ? "Nova média de entradas" : "Nova média de saídas"}
            </p>
            <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatBRL(newAverage)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground block">
              {isIncome ? "Entradas alvo (mês)" : "Saídas alvo (mês)"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                aria-label="Diminuir valor alvo"
                onClick={() => nudge(-1)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1 h-8 flex-1 min-w-0 rounded-lg bg-background/60 border border-border px-2">
                <span className="text-[11px] text-muted-foreground font-mono">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => applyMasked(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-mono text-foreground text-right"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                aria-label="Aumentar valor alvo"
                onClick={() => nudge(1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground block">
              {isIncome ? "Variação (%) +/−" : "Corte (%) +/−"}
            </span>
            <div className="flex items-center gap-1 h-8 rounded-lg bg-background/60 border border-border px-2">
              <input
                type="number"
                step={1}
                value={pctDraft}
                onChange={(e) => applyPercent(e.target.value)}
                className="w-full bg-transparent outline-none text-xs font-mono text-foreground text-right"
              />
              <span className="text-[11px] text-muted-foreground font-mono">%</span>
            </div>
          </label>
        </div>

        <div
          className={cn(
            "rounded-xl border p-3 space-y-1.5",
            totalSimulatedMonthly < 0
              ? "border-destructive/30 bg-destructive/10"
              : "border-emerald-500/30 bg-emerald-500/10",
          )}
        >
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            {isIncome ? "Ganho total na meta" : "Economia total na meta"}
          </p>
          <p
            className={cn(
              "text-xl font-bold font-mono",
              totalSimulatedMonthly < 0
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {signedBRL(totalSimulatedMonthly)}<span className="text-xs font-normal">/mês</span>
          </p>
          <div className="pt-1.5 mt-1 border-t border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">
                {isIncome ? "Ganho nesta categoria" : "Economia nesta categoria"}
              </span>
              <span className="font-mono text-foreground">{signedBRL(delta)}/mês</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Novo valor da categoria</span>
              <span className="font-mono">{formatBRL(projected)}/mês</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/** Espelho simulado das barrinhas de categoria (valor já com corte/aumento). */
export function SimulatedCategoryList({
  items,
  percents,
  kind,
  selected,
  onSelect,
}: {
  items: CategoryBreakdown[];
  percents: Record<string, number>;
  kind: SimulationKind;
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const isIncome = kind === "income";
  const projectedOf = (c: CategoryBreakdown) => {
    const pct = percents[c.name] ?? 0;
    const delta = (c.total * pct) / 100;
    return isIncome ? c.total + delta : Math.max(0, c.total - delta);
  };
  const total = items.reduce((s, c) => s + projectedOf(c), 0);

  if (items.length === 0) return null;

  return (
    <div className="glass-card p-4 space-y-2">
      <p className="text-[11px] text-muted-foreground">
        {isIncome ? "Entradas simuladas por categoria" : "Saídas simuladas por categoria"}
      </p>
      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        {items.map((c) => {
          const projected = projectedOf(c);
          const pct = total > 0 ? (projected / total) * 100 : 0;
          const sim = percents[c.name] ?? 0;
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
                  <span
                    className={cn(
                      "font-mono shrink-0",
                      sim > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatBRL(projected)}/mês
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      sim > 0 ? "bg-emerald-500/70" : isIncome ? "bg-emerald-500/40" : "bg-primary/40",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Cards espelhados: capacidade e sobra recalculadas com a simulação. */
export function SimulationSummary({
  baseCapacity,
  simulatedCapacity,
  baseLeftover,
  simulatedLeftover,
  simulatedGain,
  simulatedSaving,
  onCreateGoal,
}: {
  baseCapacity: number;
  simulatedCapacity: number;
  baseLeftover: number;
  simulatedLeftover: number;
  simulatedGain: number;
  simulatedSaving: number;
  onCreateGoal?: (draft: GoalDraft) => void;
}) {
  const diff = (a: number, b: number) => {
    const d = a - b;
    if (Math.abs(d) < 0.01) return null;
    return `${d > 0 ? "+" : "−"} ${formatBRL(Math.abs(d))}`;
  };

  const monthly = Math.round((simulatedGain + simulatedSaving) * 100) / 100;

  return (
    <div className="space-y-2.5">
      <SummaryRow
        label="Capacidade mensal simulada"
        value={simulatedCapacity}
        delta={diff(simulatedCapacity, baseCapacity)}
        danger={simulatedCapacity <= 0}
      />
      <SummaryRow
        label="Sobra simulada até dez"
        value={simulatedLeftover}
        delta={diff(simulatedLeftover, baseLeftover)}
        danger={simulatedLeftover < 0}
      />
      <Button
        className="w-full gap-1.5"
        disabled={monthly <= 0}
        onClick={() =>
          onCreateGoal?.({
            name: "Meta com base na simulação",
            target: Math.round(monthly * PLAN_MONTHS * 100) / 100,
            deadline: deadlineFromMonths(PLAN_MONTHS),
            monthly,
          })
        }
      >
        <Sparkles className="h-4 w-4" />
        Criar meta com base nisso
      </Button>
      {monthly > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          Junta {formatBRL(simulatedGain)}/mês de ganho e {formatBRL(simulatedSaving)}/mês de
          economia · {formatBRL(monthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses.
        </p>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  delta,
  danger,
}: { label: string; value: number; delta: string | null; danger: boolean }) {
  return (
    <div className="glass-card px-4 py-3 space-y-1">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        <PiggyBank className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "text-lg font-bold font-mono truncate",
          danger ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {formatBRL(value)}
      </p>
      {delta && <p className="text-[11px] font-mono text-muted-foreground">{delta} vs. real</p>}
    </div>
  );
}

export function RealBalanceCard({ value }: { value: number }) {
  return (
    <FinancialMetricCard
      icon={<Wallet className="h-4 w-4" />}
      label="Saldo total"
      value={formatBRL(value)}
      tone="primary"
    />
  );
}

export function RealCapacityCard({ value }: { value: number }) {
  return (
    <FinancialMetricCard
      icon={<PiggyBank className="h-4 w-4" />}
      label="Capacidade mensal estimada"
      value={formatBRL(value)}
      tone={value <= 0 ? "danger" : "success"}
    />
  );
}

export function RealLeftoverCard({ value }: { value: number }) {
  return (
    <FinancialMetricCard
      icon={<PiggyBank className="h-4 w-4" />}
      label="Sobra estimada até dez"
      value={formatBRL(value)}
      tone={value < 0 ? "danger" : "default"}
    />
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
}: {
  items: CategoryBreakdown[];
  emptyLabel: string;
  barClass: string;
  hint?: string;
  simulated: Record<string, number>;
  simulatedLabel: (percent: number, value: number) => string;
  selected: string | null;
  onSelect: (name: string) => void;
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
      )}
    </div>
  );
}

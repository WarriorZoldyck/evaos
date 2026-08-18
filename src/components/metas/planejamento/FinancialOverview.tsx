import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Wallet, TrendingDown, TrendingUp, PiggyBank, Sparkles, RotateCcw, ChevronDown, CalendarClock,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";


import { useCompany } from "@/contexts/CompanyContext";
import type { CategoryBreakdown, MetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { FinancialMetricCard } from "./FinancialMetricCard";
import { formatBRL } from "@/lib/goalPlanning";
import { deadlineFromMonths } from "@/lib/savingsSimulator";
import { buildCategoryProgress, type BudgetStatus, type CategoryProgress } from "@/lib/budgetProgress";
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


/**
 * Lê o que o usuário digitou em reais (não em centavos): "10.000", "10000",
 * "10.000,50" e "10000.50" viram 10000 / 10000,50.
 */
function parseTypedAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : // sem vírgula: pontos são separadores de milhar quando agrupam 3 dígitos
      /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}


/** Formata com sinal explícito (+/−) para deltas de simulação. */
export function signedBRL(value: number): string {
  if (Math.abs(value) < 0.005) return formatBRL(0);
  return `${value > 0 ? "+" : "−"} ${formatBRL(Math.abs(value))}`;
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

/** Bloco real: card de média (a lista pareada é renderizada fora). */
export function RealAverageBlock({
  kind,
  stats,
  onToggle,
}: {
  kind: SimulationKind;
  stats: MetasSidebarStats;
  simulated?: Record<string, number>;
  selected?: string | null;
  onSelect?: (name: string) => void;
  open?: boolean;
  onToggle: () => void;
}) {
  const isIncome = kind === "income";
  return (
    <button type="button" onClick={onToggle} className="w-full h-full text-left">
      <FinancialMetricCard
        icon={isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        label={isIncome ? "Média de entradas / mês" : "Média de saídas / mês"}
        value={formatBRL(isIncome ? stats.avgIncomeMonth : stats.avgSpentMonth)}
        tone={isIncome ? "success" : "default"}
      />
    </button>
  );
}


/** Espelho do card de média: valor já com a meta aplicada. */
export function MetaAverageCard({
  kind,
  value,
  base,
}: { kind: SimulationKind; value: number; base: number }) {
  const isIncome = kind === "income";
  const delta = value - base;
  return (
    <div className="glass-card px-3.5 py-2.5 h-full flex flex-col justify-center gap-1">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        {isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span className="truncate">
          {isIncome ? "Meta de entradas / mês" : "Meta de saídas / mês"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "text-base font-bold font-mono truncate",
            isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {formatBRL(value)}
        </p>
        {Math.abs(delta) >= 0.01 && (
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {signedBRL(delta)} vs. real
          </span>
        )}
      </div>
    </div>
  );
}



/** Painel lateral: ajuste da meta mensal da categoria (slider + campos). */
export function OverviewDetailPanel({
  mode,
  category,
  percent,
  newAverage,
  onPercentChange,
  onReset,
}: {
  mode: SimulationKind;
  category: CategoryBreakdown | null;
  percent: number;
  /** Soma da simulação de todas as categorias do mesmo tipo. */
  totalSimulatedMonthly?: number;
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

  // UI: direita sempre significa "aumentar o valor da categoria".
  // Internamente, saídas usam percentual positivo = corte, então invertemos.
  const uiPercent = isIncome ? percent : -percent;
  const toInternal = (ui: number) => (isIncome ? ui : -ui);

  const minPct = -100;
  const maxPct = isIncome ? 300 : 100;

  // O campo aceita digitação livre em reais; só vira percentual no commit
  // (blur/Enter). Enquanto está focado, nada reescreve o que o usuário digita.
  const [draft, setDraft] = useState<string>(() => maskFromNumber(projected));
  const valueFocused = useRef(false);
  useEffect(() => {
    if (valueFocused.current) return;
    setDraft(maskFromNumber(projected));
  }, [projected]);

  const [pctDraft, setPctDraft] = useState<string>(() => formatPctBR(uiPercent));
  const pctFocused = useRef(false);
  useEffect(() => {
    if (pctFocused.current) return;
    setPctDraft(formatPctBR(uiPercent));
  }, [uiPercent]);


  /** Converte um valor alvo em percentual assinado (aceita mais e menos). */
  const commitTarget = (value: number) => {
    if (original <= 0) return;
    const target = Math.max(0, value);
    const pct = isIncome
      ? ((target - original) / original) * 100
      : ((original - target) / original) * 100;
    onPercentChange(Math.round(pct * 100) / 100);
  };

  /** Aplica o valor digitado (em reais) e reformata o campo. */
  const commitDraft = () => {
    const parsed = parseTypedAmount(draft);
    if (parsed === null) {
      setDraft(maskFromNumber(projected));
      return;
    }
    const target = Math.max(0, parsed);
    setDraft(maskFromNumber(target));
    commitTarget(target);
  };

  const applyPercent = (raw: string) => {
    setPctDraft(raw);
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) return;
    onPercentChange(Math.round(toInternal(value) * 100) / 100);
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

      <div className="glass-card p-4 space-y-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{category.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Média atual · <span className="font-mono">{formatBRL(original)}/mês</span>
          </p>
        </div>

        {/* Controle principal: deslizar para mais ou para menos. */}
        <div className="space-y-1.5">
          <Slider
            value={[Math.max(minPct, Math.min(maxPct, Math.round(uiPercent)))]}
            min={minPct}
            max={maxPct}
            step={1}
            onValueChange={([v]) => onPercentChange(toInternal(v))}
            aria-label={isIncome ? "Variação da entrada" : "Variação da saída"}
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{minPct}%</span>
            <span className="text-foreground font-semibold">
              {uiPercent > 0 ? "+" : ""}{Math.round(uiPercent)}%
            </span>
            <span>+{maxPct}%</span>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground block">
              {isIncome ? "Entradas alvo (mês)" : "Saídas alvo (mês)"}
            </span>
            <div className="flex items-center gap-1 h-8 rounded-lg bg-background/60 border border-border px-2">
              <span className="text-[11px] text-muted-foreground font-mono">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft}
                onFocus={(e) => {
                  valueFocused.current = true;
                  e.currentTarget.select();
                }}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  valueFocused.current = false;
                  commitDraft();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setDraft(maskFromNumber(projected));
                    e.currentTarget.blur();
                  }
                }}
                className="w-full bg-transparent outline-none text-xs font-mono text-foreground text-right"
              />
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground block">
              Variação (%) +/−
            </span>
            <div className="flex items-center gap-1 h-8 rounded-lg bg-background/60 border border-border px-2">
              <input
                type="text"
                inputMode="decimal"
                value={pctDraft}
                onFocus={(e) => { pctFocused.current = true; e.currentTarget.select(); }}
                onChange={(e) => applyPercent(e.target.value)}
                onBlur={() => {
                  pctFocused.current = false;
                  setPctDraft(String(uiPercent).replace(".", ","));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setPctDraft(String(uiPercent).replace(".", ","));
                    e.currentTarget.blur();
                  }
                }}
                className="w-full bg-transparent outline-none text-xs font-mono text-foreground text-right"
              />
              <span className="text-[11px] text-muted-foreground font-mono">%</span>
            </div>
          </label>
        </div>

        <div className="pt-2 border-t border-border/40 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Novo valor da categoria</span>
            <span className="font-mono text-foreground">{formatBRL(projected)}/mês</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground truncate">
              {isIncome ? "Nova média de entradas" : "Nova média de saídas"}
            </span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(newAverage)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lista pareada: real · meta · realizado no mês. */
export function PairedCategoryList({
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
    const d = (c.total * pct) / 100;
    return Math.max(0, isIncome ? c.total + d : c.total - d);
  };
  const realTotal = items.reduce((s, c) => s + c.total, 0);
  const simTotal = items.reduce((s, c) => s + projectedOf(c), 0);

  if (items.length === 0) {
    return (
      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground text-center py-2">
          {isIncome
            ? "Sem receitas categorizadas neste ano."
            : "Sem despesas categorizadas neste ano."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-2.5">
      <div className="grid grid-cols-[1fr_1fr_1.1fr] gap-x-5 text-[11px] text-muted-foreground">

        <span className="truncate">
          {isIncome ? "Entradas reais por categoria" : "Saídas reais por categoria"}
        </span>
        <span className="truncate">{isIncome ? "Entradas na meta" : "Saídas na meta"}</span>
        <span className="truncate">Realizado neste mês</span>
      </div>
      <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
        {items.map((c) => {
          const projected = projectedOf(c);
          const sim = percents[c.name] ?? 0;
          const isSelected = selected === c.name;
          const realPct = realTotal > 0 ? (c.total / realTotal) * 100 : 0;
          const simPct = simTotal > 0 ? (projected / simTotal) * 100 : 0;
          const progress = buildCategoryProgress(
            { name: c.name, average: c.total, actual: c.monthTotal, target: projected },
            kind,
          );
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onSelect(c.name)}
              className={cn(
                "w-full grid grid-cols-[1fr_1fr_1.1fr] gap-x-5 items-start text-left rounded-xl px-2.5 py-2 transition-colors hover:bg-accent/30",
                isSelected && "bg-accent/40 ring-1 ring-primary/40",
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{c.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {formatBRL(c.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isIncome ? "bg-emerald-500/70" : "bg-primary/70",
                    )}
                    style={{ width: `${realPct}%` }}
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      "truncate font-mono",
                      sim !== 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {sim !== 0 ? `${sim > 0 ? "+" : "−"}${Math.abs(Math.round(sim))}%` : "—"}
                  </span>
                  <span
                    className={cn(
                      "font-mono shrink-0",
                      sim !== 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {formatBRL(projected)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      sim !== 0 ? "bg-emerald-500/70" : isIncome ? "bg-emerald-500/30" : "bg-primary/30",
                    )}
                    style={{ width: `${simPct}%` }}
                  />
                </div>
              </div>

              <ProgressCell progress={progress} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_BAR: Record<BudgetStatus, string> = {
  ok: "bg-emerald-500/70",
  near: "bg-amber-500/80",
  over: "bg-destructive/80",
  behind: "bg-amber-500/80",
  reached: "bg-emerald-500/80",
};

const STATUS_TEXT: Record<BudgetStatus, string> = {
  ok: "text-muted-foreground",
  near: "text-amber-600 dark:text-amber-400",
  over: "text-destructive",
  behind: "text-amber-600 dark:text-amber-400",
  reached: "text-emerald-600 dark:text-emerald-400",
};

/** Terceira coluna: quanto já foi efetivado no mês frente à meta. */
function ProgressCell({ progress }: { progress: CategoryProgress }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-mono shrink-0", STATUS_TEXT[progress.status])}>
          {formatBRL(progress.actual)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {Math.round(progress.consumedPct)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", STATUS_BAR[progress.status])}
          style={{ width: `${Math.min(100, progress.consumedPct)}%` }}
        />
      </div>
      <p className={cn("text-[10px] truncate", STATUS_TEXT[progress.status])}>{progress.message}</p>
    </div>
  );
}

/** Card do realizado do mês (totais de entrada/saída). */
export function RealizedMonthCard({
  kind,
  actual,
  target,
}: { kind: SimulationKind; actual: number; target: number }) {
  const progress = buildCategoryProgress(
    { name: "total", average: target, actual, target },
    kind,
  );
  const isIncome = kind === "income";
  return (
    <div className="glass-card px-3.5 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        <span className="truncate">
          {isIncome ? "Recebido neste mês" : "Gasto neste mês"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("text-lg font-bold font-mono truncate", STATUS_TEXT[progress.status])}>
          {formatBRL(actual)}
        </p>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {Math.round(progress.consumedPct)}% da meta
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", STATUS_BAR[progress.status])}
          style={{ width: `${Math.min(100, progress.consumedPct)}%` }}
        />
      </div>
      <p className={cn("text-[11px] truncate", STATUS_TEXT[progress.status])}>{progress.message}</p>
    </div>
  );
}


/** Cards espelhados: capacidade e sobra recalculadas com a simulação. */
export function SimulationSummary({
  baseCapacity,
  simulatedCapacity,
  baseLeftover,
  simulatedLeftover,
}: {
  baseCapacity: number;
  simulatedCapacity: number;
  baseLeftover: number;
  simulatedLeftover: number;
}) {
  const diff = (a: number, b: number) => {
    const d = a - b;
    if (Math.abs(d) < 0.01) return null;
    return `${d > 0 ? "+" : "−"} ${formatBRL(Math.abs(d))}`;
  };

  return (
    <div className="space-y-2.5">
      <SummaryRow
        label="Nova capacidade mensal"
        value={simulatedCapacity}
        delta={diff(simulatedCapacity, baseCapacity)}
        danger={simulatedCapacity <= 0}
      />
      <SummaryRow
        label="Nova sobra até dez"
        value={simulatedLeftover}
        delta={diff(simulatedLeftover, baseLeftover)}
        danger={simulatedLeftover < 0}
      />
    </div>
  );
}

/** Ação lateral: cria uma meta a partir do ganho + economia simulados. */
export function CreateGoalFromSimulation({
  simulatedGain,
  simulatedSaving,
  onCreateGoal,
}: {
  simulatedGain: number;
  simulatedSaving: number;
  onCreateGoal?: (draft: GoalDraft) => void;
}) {
  const monthly = Math.round((simulatedGain + simulatedSaving) * 100) / 100;
  return (
    <div className="space-y-2">
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
          {formatBRL(monthly)}/mês · {formatBRL(monthly * PLAN_MONTHS)} em {PLAN_MONTHS} meses.
        </p>
      )}
    </div>
  );
}


/** Card de resumo com valor por mês, projeção anual e o plano montado. */
function TotalsCard({
  label,
  icon,
  monthly,
  months,
  kind,
  items,
  percents,
}: {
  label: string;
  icon: React.ReactNode;
  monthly: number;
  months: number;
  kind: SimulationKind;
  items: CategoryBreakdown[];
  percents: Record<string, number>;
}) {
  const negative = monthly < -0.005;
  const [open, setOpen] = useState(false);
  const isIncome = kind === "income";

  const plan = items
    .map((c) => ({ name: c.name, pct: percents[c.name] ?? 0, delta: (c.total * (percents[c.name] ?? 0)) / 100 }))
    .filter((r) => Math.abs(r.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="glass-card px-3.5 py-2.5 space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left space-y-1"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {icon}
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </div>
        <p
          className={cn(
            "text-lg font-bold font-mono truncate",
            negative ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {signedBRL(monthly)}
          <span className="text-xs font-normal text-muted-foreground">/mês</span>
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          {signedBRL(monthly * months)} em {months} {months === 1 ? "mês" : "meses"}
        </p>
      </button>

      {open && (
        <div className="pt-2 mt-1 border-t border-border/40 space-y-1">
          {plan.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {isIncome
                ? "Ainda sem aumentos simulados nas entradas."
                : "Ainda sem cortes simulados nas saídas."}
            </p>
          ) : (
            plan.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground">
                  {r.name} <span className="font-mono">({r.pct > 0 ? "+" : "−"}{Math.abs(Math.round(r.pct))}%)</span>
                </span>
                <span className="font-mono text-foreground shrink-0">{signedBRL(r.delta)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Card "Ganho total" (mês e ano). */
export function GainTotalCard({
  monthly,
  months = PLAN_MONTHS,
  items = [],
  percents = {},
}: {
  monthly: number;
  months?: number;
  items?: CategoryBreakdown[];
  percents?: Record<string, number>;
}) {
  return (
    <TotalsCard
      label="Ganho total"
      icon={<TrendingUp className="h-4 w-4" />}
      monthly={monthly}
      months={months}
      kind="income"
      items={items}
      percents={percents}
    />
  );
}

/** Card "Meta de economia" (mês e ano). */
export function SavingGoalCard({
  monthly,
  months = PLAN_MONTHS,
  items = [],
  percents = {},
}: {
  monthly: number;
  months?: number;
  items?: CategoryBreakdown[];
  percents?: Record<string, number>;
}) {
  return (
    <TotalsCard
      label="Meta de economia"
      icon={<PiggyBank className="h-4 w-4" />}
      monthly={monthly}
      months={months}
      kind="expense"
      items={items}
      percents={percents}
    />
  );
}



function SummaryRow({
  label,
  value,
  delta,
  danger,
}: { label: string; value: number; delta: string | null; danger: boolean }) {
  return (
    <div className="glass-card px-3.5 py-2.5 space-y-1">
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
      dense
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
      dense
      tone={value < 0 ? "danger" : "default"}
    />
  );
}

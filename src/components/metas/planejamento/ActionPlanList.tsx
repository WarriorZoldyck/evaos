import { CheckCircle2, Circle, Clock, TrendingDown, TrendingUp, PiggyBank, CalendarClock, Target, LineChart } from "lucide-react";
import { formatBRL, type ActionPlanItem, type ActionPlanKind } from "@/lib/goalPlanning";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ActionPlanKind, React.ComponentType<{ className?: string }>> = {
  REDUCE_EXPENSE: TrendingDown,
  INCREASE_INCOME: TrendingUp,
  INCREASE_CONTRIBUTION: PiggyBank,
  EXTEND_DEADLINE: CalendarClock,
  REDUCE_TARGET: Target,
  INVESTMENT: LineChart,
};

const STATUS_ICON = {
  CONCLUIDO: CheckCircle2,
  EM_ANDAMENTO: Clock,
  PENDENTE: Circle,
} as const;

export function ActionPlanItemRow({ item }: { item: ActionPlanItem }) {
  const KindIcon = KIND_ICON[item.kind];
  const StatusIcon = STATUS_ICON[item.status];

  return (
    <li className="flex items-start gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <KindIcon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <StatusIcon
            className={cn(
              "h-4 w-4 shrink-0 mt-0.5",
              item.status === "CONCLUIDO"
                ? "text-emerald-500"
                : item.status === "EM_ANDAMENTO"
                  ? "text-primary"
                  : "text-muted-foreground",
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        <div className="flex items-center gap-2 mt-1">
          {item.estimatedMonthlyImpact !== null && (
            <span className="text-[11px] font-mono text-muted-foreground">
              impacto ~{formatBRL(item.estimatedMonthlyImpact)}/mês
            </span>
          )}
          {item.source === "IA" && (
            <span className="text-[10px] uppercase tracking-wide text-primary">EVA</span>
          )}
        </div>
      </div>
    </li>
  );
}

export function ActionPlanList({
  items,
  footer,
}: {
  items: ActionPlanItem[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        Plano de ação
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-3">
          Defina alvo e prazo da meta para montar o plano.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 mt-1">
          {items.map((i) => (
            <ActionPlanItemRow key={i.id} item={i} />
          ))}
        </ul>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  formatBRL,
  type GoalResolutionAction,
  type GoalScoreBreakdown,
  type CategoryAmount,
} from "@/lib/goalPlanning";

interface Props {
  breakdown: GoalScoreBreakdown;
  topCategories: CategoryAmount[];
  onResolve: (action: GoalResolutionAction) => void;
  onCombine: () => void;
  onReset?: () => void;
  isSimulated?: boolean;
}

export function GoalResolutionPanel({
  breakdown,
  topCategories,
  onResolve,
  onCombine,
  onReset,
  isSimulated,
}: Props) {
  const deficit = Math.max(0, -(breakdown.capacityGap ?? 0));
  const biggest = topCategories[0];

  const options: { label: string; hint: string; action: GoalResolutionAction }[] = [
    {
      label: "Aumentar prazo em 6 meses",
      hint: "Dilui o aporte necessário ao longo de mais tempo.",
      action: { kind: "EXTEND_DEADLINE", months: 6 },
    },
    {
      label: `Aumentar aporte em ${formatBRL(deficit)}`,
      hint: "Assume que você consegue reservar essa diferença.",
      action: { kind: "INCREASE_CONTRIBUTION", amount: deficit },
    },
    {
      label: biggest
        ? `Reduzir ${formatBRL(Math.min(deficit, Math.abs(biggest.total)))} em ${biggest.name}`
        : `Reduzir ${formatBRL(deficit)} em gastos`,
      hint: "Corta despesas recorrentes para liberar capacidade.",
      action: {
        kind: "REDUCE_EXPENSE",
        amount: biggest ? Math.min(deficit, Math.abs(biggest.total)) : deficit,
        category: biggest?.name,
      },
    },
    {
      label: `Aumentar renda em ${formatBRL(deficit)}`,
      hint: "Renda extra sem mexer nos gastos atuais.",
      action: { kind: "INCREASE_INCOME", amount: deficit },
    },
  ];

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Como podemos tornar essa meta possível?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Faltam {formatBRL(deficit)} por mês para o aporte necessário.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onResolve(o.action)}
            className="glass-card glass-card-interactive text-left p-3"
          >
            <p className="text-sm font-medium text-foreground">{o.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{o.hint}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCombine}>
          Combinar estratégias
        </Button>
        {isSimulated && onReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Desfazer simulação
          </Button>
        )}
      </div>
    </div>
  );
}

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { formatBRL } from "@/lib/goalPlanning";
import { buildCategoryProgressList, buildRiskList } from "@/lib/budgetProgress";
import type { CategoryBreakdown } from "@/hooks/useMetasSidebarStats";
import { cn } from "@/lib/utils";

/**
 * "No que não dá para gastar mais este mês."
 * Determinístico: usa os mesmos números da lista de categorias.
 */
export function MonthRiskCard({
  expenseCategories,
  percents,
  onSelect,
}: {
  expenseCategories: CategoryBreakdown[];
  percents: Record<string, number>;
  onSelect?: (name: string) => void;
}) {
  const progress = buildCategoryProgressList(
    expenseCategories.map((c) => {
      const pct = percents[c.name] ?? 0;
      const target = Math.max(0, c.total - (c.total * pct) / 100);
      return { name: c.name, average: c.total, actual: c.monthTotal, target };
    }),
    "expense",
  );
  const risks = buildRiskList(progress).slice(0, 5);

  return (
    <div className="glass-card px-3.5 py-2.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        {risks.length > 0 ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        )}
        <span className="truncate">Atenção este mês</span>
      </div>

      {risks.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma categoria perto do limite. Está dentro das metas até aqui.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {risks.map((r) => (
            <li key={r.name}>
              <button
                type="button"
                onClick={() => onSelect?.(r.name)}
                className="w-full text-left rounded-lg px-1 py-0.5 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-medium text-foreground">{r.name}</span>
                  <span
                    className={cn(
                      "font-mono shrink-0",
                      r.status === "over" ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {Math.round(r.consumedPct)}%
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[10px] truncate",
                    r.status === "over" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {r.status === "over"
                    ? `Estourou ${formatBRL(r.overBy)}`
                    : `Só cabe mais ${formatBRL(r.remaining)}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

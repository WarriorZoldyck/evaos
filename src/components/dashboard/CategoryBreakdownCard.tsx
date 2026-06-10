import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryIcon } from "@/lib/dashboardInsights";
import type { CategorySummary } from "@/hooks/useDashboardData";

interface Props {
  revenueCategories: CategorySummary[];
  expenseCategories: CategorySummary[];
  totalReceitas: number;
  totalDespesas: number;
  loading: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function Section({
  title,
  data,
  total,
  type,
  emptyMessage,
}: {
  title: string;
  data: CategorySummary[];
  total: number;
  type: "receita" | "despesa";
  emptyMessage: string;
}) {
  const navigate = useNavigate();
  const items = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
        <span className="text-xs text-muted-foreground">{fmt(total)}</span>
      </div>
      {items.length === 0 ? (
        <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((c) => {
            const Icon = getCategoryIcon(c.name);
            const pct = total > 0 ? (c.value / total) * 100 : 0;
            return (
              <button
                key={c.id}
                onClick={() =>
                  navigate(
                    `/lancamentos?category=${encodeURIComponent(c.name)}&type=${type}`,
                  )
                }
                className="w-full text-left rounded-lg border border-border/60 bg-card/40 hover:bg-card hover:border-primary/40 transition-all p-2.5 group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${c.fill}22`, color: c.fill }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-sm font-semibold font-display shrink-0">
                        {fmt(c.value)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: c.fill,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CategoryBreakdownCard({
  revenueCategories,
  expenseCategories,
  totalReceitas,
  totalDespesas,
  loading,
}: Props) {
  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-base font-semibold font-display">
          Categorias — Receitas e Despesas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <Section
              title="Receitas"
              data={revenueCategories}
              total={totalReceitas}
              type="receita"
              emptyMessage="Nenhuma receita no período"
            />
            <div className="h-px bg-border/60" />
            <Section
              title="Despesas"
              data={expenseCategories}
              total={totalDespesas}
              type="despesa"
              emptyMessage="Nenhuma despesa no período"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { getCategoryIcon, dailySeries, pctChange } from "@/lib/dashboardInsights";
import type { CategorySummary } from "@/hooks/useDashboardData";

interface Tx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
}

interface Props {
  categories: CategorySummary[];
  total: number;
  allTransactions: Tx[];
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  loading: boolean;
  embedded?: boolean;
}


function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function CategoryDetailGrid({
  categories,
  total,
  allTransactions,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
  loading,
}: Props) {
  const navigate = useNavigate();

  const items = useMemo(() => {
    const top = [...categories].sort((a, b) => b.value - a.value).slice(0, 6);
    return top.map((c) => {
      const txsForCat = allTransactions.filter(
        (t) => t.type === "despesa" && t.category === c.name,
      );
      // Previous month total for this category
      const prevS = prevStart.toISOString().slice(0, 10);
      const prevE = prevEnd.toISOString().slice(0, 10);
      const prevTotal = txsForCat
        .filter(
          (t) =>
            t.status === "Pago" && t.payment_date >= prevS && t.payment_date <= prevE,
        )
        .reduce((acc, t) => acc + Number(t.amount), 0);
      const series = dailySeries(
        txsForCat,
        currentStart,
        currentEnd,
        (t) => Number(t.amount),
      );
      const delta = pctChange(c.value, prevTotal);
      return { ...c, series, delta };
    });
  }, [categories, allTransactions, currentStart, currentEnd, prevStart, prevEnd]);

  if (loading) {
    return (
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma despesa no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-premium">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => {
            const Icon = getCategoryIcon(it.name);
            const pct = total > 0 ? (it.value / total) * 100 : 0;
            const isUp = (it.delta ?? 0) >= 0;
            return (
              <button
                key={it.id}
                onClick={() =>
                  navigate(
                    `/lancamentos?category=${encodeURIComponent(it.name)}&type=despesa`,
                  )
                }
                className="text-left rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/40 transition-all p-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${it.fill}22`, color: it.fill }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.name}</p>
                      <p className="text-base font-bold font-display">{fmt(it.value)}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="flex items-end justify-between mt-2 gap-2">
                  <div className="text-[10px] text-muted-foreground">
                    {pct.toFixed(1)}% do total
                    {it.delta !== null && (
                      <span
                        className={`ml-2 ${isUp ? "text-destructive" : "text-success"}`}
                      >
                        {isUp ? "↗" : "↘"} {Math.abs(it.delta).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="h-7 w-20 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={it.series}>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={it.fill}
                          fill={it.fill}
                          fillOpacity={0.2}
                          strokeWidth={1.5}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

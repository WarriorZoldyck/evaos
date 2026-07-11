import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export type CategoryDetailMode = "receita" | "despesa";

interface Props {
  revenueCategories: CategorySummary[];
  expenseCategories: CategorySummary[];
  totalReceitas: number;
  totalDespesas: number;
  allTransactions: Tx[];
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  loading: boolean;
  embedded?: boolean;
  mode?: CategoryDetailMode;
  onModeChange?: (mode: CategoryDetailMode) => void;
  onCategoryClick?: (
    item: { id: string; name: string; fill: string; value: number },
    mode: CategoryDetailMode,
  ) => void;
}


function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function CategoryDetailGrid({
  revenueCategories,
  expenseCategories,
  totalReceitas,
  totalDespesas,
  allTransactions,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
  loading,
  embedded = false,
  mode: modeProp,
  onModeChange,
  onCategoryClick,
}: Props) {
  const navigate = useNavigate();
  const mode: CategoryDetailMode = modeProp ?? "despesa";


  const categories = mode === "receita" ? revenueCategories : expenseCategories;
  const total = mode === "receita" ? totalReceitas : totalDespesas;

  const items = useMemo(() => {
    const sorted = [...categories].sort((a, b) => b.value - a.value);
    const prevS = prevStart.toISOString().slice(0, 10);
    const prevE = prevEnd.toISOString().slice(0, 10);
    return sorted.map((c) => {
      const txsForCat = allTransactions.filter(
        (t) => t.type === mode && (t.category === c.id || t.category === c.name),
      );
      const prevTotal = txsForCat
        .filter(
          (t) => t.status === "Pago" && t.payment_date >= prevS && t.payment_date <= prevE,
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
  }, [categories, allTransactions, currentStart, currentEnd, prevStart, prevEnd, mode]);

  const toggle = onModeChange ? (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as CategoryDetailMode)}>
      <TabsList className="h-8">
        <TabsTrigger value="despesa" className="text-xs px-3">Despesas</TabsTrigger>
        <TabsTrigger value="receita" className="text-xs px-3">Receitas</TabsTrigger>
      </TabsList>
    </Tabs>
  ) : null;

  const header = (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground/90">
          {mode === "receita" ? "Receitas por categoria" : "Despesas por categoria"}
        </p>
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "categoria" : "categorias"} · {fmt(total)}
        </p>
      </div>
      {toggle}
    </div>
  );

  if (loading) {
    const skeleton = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
    if (embedded) {
      return (
        <div className="h-full flex flex-col min-h-0">
          {header}
          {skeleton}
        </div>
      );
    }
    return (
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
        </CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    const empty = (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        {mode === "receita" ? "Nenhuma receita no período" : "Nenhuma despesa no período"}
      </div>
    );
    if (embedded) {
      return (
        <div className="h-full flex flex-col min-h-0">
          {header}
          {empty}
        </div>
      );
    }
    return (
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
        </CardHeader>
        <CardContent>{empty}</CardContent>
      </Card>
    );
  }

  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((it, idx) => {
        const Icon = getCategoryIcon(it.name);
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        const isUp = (it.delta ?? 0) >= 0;
        const isTop = idx === 0;
        // Para receitas: crescer é bom (success); para despesas: crescer é ruim (destructive)
        const deltaClass =
          mode === "despesa"
            ? isUp
              ? "text-destructive"
              : "text-success"
            : isUp
              ? "text-success"
              : "text-destructive";
        return (
          <button
            key={it.id}
            onClick={() =>
              navigate(
                `/lancamentos?category=${encodeURIComponent(it.name)}&type=${mode}`,
              )
            }
            className={`relative text-left rounded-xl border bg-card/50 hover:bg-card transition-all p-3 group ${
              isTop
                ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
                : "border-border hover:border-primary/40"
            }`}
          >
            {isTop && (
              <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-primary/80">
                <Crown className="h-3 w-3" />
                Maior
              </span>
            )}
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
              {!isTop && (
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              )}
            </div>
            <div className="flex items-end justify-between mt-2 gap-2">
              <div className="text-[10px] text-muted-foreground">
                {pct.toFixed(1)}% do total
                {it.delta !== null && (
                  <span className={`ml-2 ${deltaClass}`}>
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
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {header}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">{grid}</div>
      </div>
    );
  }

  return (
    <Card className="shadow-premium">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold font-display">Categorias</CardTitle>
        {toggle}
      </CardHeader>
      <CardContent>{grid}</CardContent>
    </Card>
  );
}

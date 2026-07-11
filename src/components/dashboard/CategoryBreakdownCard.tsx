import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
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

function Donut({
  title,
  data,
  total,
  type,
  emptyMessage,
  loading,
}: {
  title: string;
  data: CategorySummary[];
  total: number;
  type: "receita" | "despesa";
  emptyMessage: string;
  loading: boolean;
}) {
  const navigate = useNavigate();

  const handleClick = (_: any, index: number) => {
    const c = data[index];
    if (c) navigate(`/lancamentos?category=${encodeURIComponent(c.name)}&type=${type}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
        <span className="text-xs text-muted-foreground">{fmt(total)}</span>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Donut */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                  onClick={handleClick}
                  className="cursor-pointer"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmt(value)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with icons */}
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {data.map((c) => {
              const Icon = getCategoryIcon(c.name);
              const pct = total > 0 ? (c.value / total) * 100 : 0;
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    navigate(`/lancamentos?category=${encodeURIComponent(c.name)}&type=${type}`)
                  }
                  className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/40 transition text-left"
                >
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${c.fill}22`, color: c.fill }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                  <span className="text-xs font-semibold font-display shrink-0">
                    {fmt(c.value)}
                  </span>
                </button>
              );
            })}
          </div>
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
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Donut
            title="Receitas"
            data={revenueCategories}
            total={totalReceitas}
            type="receita"
            emptyMessage="Nenhuma receita no período"
            loading={loading}
          />
          <div className="hidden xl:block w-px bg-border/60" />
          <Donut
            title="Despesas"
            data={expenseCategories}
            total={totalDespesas}
            type="despesa"
            emptyMessage="Nenhuma despesa no período"
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

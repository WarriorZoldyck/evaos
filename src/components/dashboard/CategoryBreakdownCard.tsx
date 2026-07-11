import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import type { CategorySummary } from "@/hooks/useDashboardData";
import { CategoryDetailGrid, type CategoryDetailMode } from "@/components/dashboard/CategoryDetailGrid";

interface DetailTx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
}

interface Props {
  revenueCategories: CategorySummary[];
  expenseCategories: CategorySummary[];
  totalReceitas: number;
  totalDespesas: number;
  loading: boolean;
  detailTransactions: DetailTx[];
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  onCategoryClick?: (
    item: { id: string; name: string; fill: string; value: number },
    mode: CategoryDetailMode,
  ) => void;
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
  detailTransactions,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
}: Props) {
  const [detailMode, setDetailMode] = useState<CategoryDetailMode>("despesa");

  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-base font-semibold font-display">
          Categorias — Receitas e Despesas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
          {/* Left: donuts stacked */}
          <div className="space-y-6">
            <Donut
              title="Receitas"
              data={revenueCategories}
              total={totalReceitas}
              type="receita"
              emptyMessage="Nenhuma receita no período"
              loading={loading}
            />
            <div className="h-px bg-border/60" />
            <Donut
              title="Despesas"
              data={expenseCategories}
              total={totalDespesas}
              type="despesa"
              emptyMessage="Nenhuma despesa no período"
              loading={loading}
            />
          </div>

          {/* Right: category detail cards filling the empty space */}
          <div className="h-full min-h-0">
            <CategoryDetailGrid
              embedded
              mode={detailMode}
              onModeChange={setDetailMode}
              revenueCategories={revenueCategories}
              expenseCategories={expenseCategories}
              totalReceitas={totalReceitas}
              totalDespesas={totalDespesas}
              allTransactions={detailTransactions}
              currentStart={currentStart}
              currentEnd={currentEnd}
              prevStart={prevStart}
              prevEnd={prevEnd}
              loading={loading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


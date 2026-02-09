import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategorySummary } from "@/hooks/useDashboardData";

interface CategorySummaryChartsProps {
  revenueCategories: CategorySummary[];
  expenseCategories: CategorySummary[];
  loading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function DoughnutChart({
  data,
  title,
  emptyMessage,
  loading,
}: {
  data: CategorySummary[];
  title: string;
  emptyMessage: string;
  loading: boolean;
}) {
  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-base font-semibold font-display">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 30%, 9%)",
                  border: "1px solid hsl(215, 25%, 16%)",
                  borderRadius: "10px",
                  color: "hsl(210, 30%, 92%)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatCurrency(value)]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span style={{ color: "hsl(215, 18%, 55%)", fontSize: 11 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function CategorySummaryCharts({
  revenueCategories,
  expenseCategories,
  loading,
}: CategorySummaryChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <DoughnutChart
        data={revenueCategories}
        title="Receitas por Categoria"
        emptyMessage="Nenhuma receita no período"
        loading={loading}
      />
      <DoughnutChart
        data={expenseCategories}
        title="Despesas por Categoria"
        emptyMessage="Nenhuma despesa no período"
        loading={loading}
      />
    </div>
  );
}

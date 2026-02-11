import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectionDays, ProjectionPoint } from "@/hooks/useDashboardData";

interface BalanceProjectionChartProps {
  getProjectionData: (days: ProjectionDays) => ProjectionPoint[];
  loading: boolean;
}

const projectionOptions: { days: ProjectionDays; label: string }[] = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "Ano todo" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
  }).format(value);
}

export function BalanceProjectionChart({ getProjectionData, loading }: BalanceProjectionChartProps) {
  const [selectedDays, setSelectedDays] = useState<ProjectionDays>(30);
  const data = getProjectionData(selectedDays);

  return (
    <Card className="shadow-premium">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold font-display">Projeção de Saldo</CardTitle>
        <div className="flex gap-1">
          {projectionOptions.map((opt) => (
            <Button
              key={opt.days}
              variant={selectedDays === opt.days ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setSelectedDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Sem dados para projeção
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(195, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(195, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 25%, 16%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(215, 18%, 55%)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(215, 25%, 16%)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "hsl(215, 18%, 55%)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 30%, 9%)",
                  border: "1px solid hsl(215, 25%, 16%)",
                  borderRadius: "10px",
                  color: "hsl(210, 30%, 92%)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value),
                  "Saldo",
                ]}
              />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="hsl(195, 100%, 50%)"
                strokeWidth={2}
                fill="url(#saldoGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(195, 100%, 50%)", stroke: "hsl(195, 100%, 70%)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

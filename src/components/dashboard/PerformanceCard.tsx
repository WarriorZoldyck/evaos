import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingDown } from "lucide-react";

interface PerformanceCardProps {
  avgDailySpending: number;
  totalExpenses: number;
  daysInPeriod: number;
  loading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function PerformanceCard({
  avgDailySpending,
  totalExpenses,
  daysInPeriod,
  loading,
}: PerformanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Análise de Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gasto médio diário</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(avgDailySpending)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total de despesas</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Dias no período</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{daysInPeriod} dias</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

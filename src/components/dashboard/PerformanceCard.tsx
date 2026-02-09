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
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
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
              <div className="h-12 w-12 rounded-xl bg-gradient-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Gasto médio diário</p>
                <p className="text-xl font-bold font-display text-foreground">{formatCurrency(avgDailySpending)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 card-hover">
                <p className="text-xs text-muted-foreground font-medium">Total de despesas</p>
                <p className="text-sm font-semibold font-display text-foreground mt-1">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 card-hover">
                <p className="text-xs text-muted-foreground font-medium">Dias no período</p>
                <p className="text-sm font-semibold font-display text-foreground mt-1">{daysInPeriod} dias</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

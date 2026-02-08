import { TrendingUp, TrendingDown, Wallet, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  faturamento: number;
  entradas: number;
  saidas: number;
  saldo: number;
  loading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface CardItemProps {
  title: string;
  value: number;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
  loading: boolean;
}

function SummaryCard({ title, value, icon: Icon, trend, loading }: CardItemProps) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-primary";

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{formatCurrency(value)}</p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${trendColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ faturamento, entradas, saidas, saldo, loading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        title="Faturamento"
        value={faturamento}
        icon={DollarSign}
        trend="neutral"
        loading={loading}
      />
      <SummaryCard
        title="Entradas"
        value={entradas}
        icon={TrendingUp}
        trend="up"
        loading={loading}
      />
      <SummaryCard
        title="Saídas"
        value={saidas}
        icon={TrendingDown}
        trend="down"
        loading={loading}
      />
      <SummaryCard
        title="Saldo do Período"
        value={saldo}
        icon={Wallet}
        trend={saldo >= 0 ? "up" : "down"}
        loading={loading}
      />
    </div>
  );
}

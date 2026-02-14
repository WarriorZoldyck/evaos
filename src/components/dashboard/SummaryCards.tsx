import { TrendingUp, TrendingDown, Wallet, DollarSign, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  faturamento: number;
  entradas: number;
  saidas: number;
  saldo: number;
  entradaPrevista: number;
  saidaPrevista: number;
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
  gradient: string;
  loading: boolean;
}

function SummaryCard({ title, value, icon: Icon, trend, gradient, loading }: CardItemProps) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-primary";

  return (
    <Card className="card-hover shadow-premium overflow-hidden relative group">
      <CardContent className="pt-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className={`text-2xl font-bold font-display ${trendColor}`}>
                {formatCurrency(value)}
              </p>
            )}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ faturamento, entradas, saidas, saldo, entradaPrevista, saidaPrevista, loading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      <SummaryCard
        title="Faturamento"
        value={faturamento}
        icon={DollarSign}
        trend="neutral"
        gradient="bg-gradient-primary"
        loading={loading}
      />
      <SummaryCard
        title="Entradas"
        value={entradas}
        icon={TrendingUp}
        trend="up"
        gradient="bg-gradient-success"
        loading={loading}
      />
      <SummaryCard
        title="Saídas"
        value={saidas}
        icon={TrendingDown}
        trend="down"
        gradient="bg-gradient-destructive"
        loading={loading}
      />
      <SummaryCard
        title="Saldo do Período"
        value={saldo}
        icon={Wallet}
        trend={saldo >= 0 ? "up" : "down"}
        gradient={saldo >= 0 ? "bg-gradient-success" : "bg-gradient-destructive"}
        loading={loading}
      />
      <SummaryCard
        title="Entrada Prevista"
        value={entradaPrevista}
        icon={Clock}
        trend="neutral"
        gradient="bg-gradient-primary"
        loading={loading}
      />
      <SummaryCard
        title="Saída Prevista"
        value={saidaPrevista}
        icon={Clock}
        trend="neutral"
        gradient="bg-gradient-destructive"
        loading={loading}
      />
    </div>
  );
}

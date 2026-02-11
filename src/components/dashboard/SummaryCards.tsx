import { TrendingUp, TrendingDown, Wallet, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface SummaryCardsProps {
  faturamento: number;
  entradas: number;
  saidas: number;
  saldo: number;
  previstoReceitas: number;
  previstoSaidas: number;
  consolidadoReceitas: number;
  consolidadoSaidas: number;
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

function ForecastSection({
  previstoReceitas,
  previstoSaidas,
  consolidadoReceitas,
  consolidadoSaidas,
  loading,
}: {
  previstoReceitas: number;
  previstoSaidas: number;
  consolidadoReceitas: number;
  consolidadoSaidas: number;
  loading: boolean;
}) {
  const pctReceitas = previstoReceitas > 0 ? Math.min((consolidadoReceitas / previstoReceitas) * 100, 100) : 0;
  const pctSaidas = previstoSaidas > 0 ? Math.min((consolidadoSaidas / previstoSaidas) * 100, 100) : 0;

  return (
    <Card className="shadow-premium">
      <CardContent className="pt-6">
        <p className="text-sm font-semibold font-display text-foreground mb-4">Previsto vs Consolidado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Receitas */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receitas</p>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Previsto</span>
                  <span className="font-medium text-foreground">{formatCurrency(previstoReceitas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Consolidado</span>
                  <span className="font-medium text-success">{formatCurrency(consolidadoReceitas)}</span>
                </div>
                <Progress value={pctReceitas} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{pctReceitas.toFixed(0)}% realizado</p>
              </>
            )}
          </div>
          {/* Despesas */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas</p>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Previsto</span>
                  <span className="font-medium text-foreground">{formatCurrency(previstoSaidas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Consolidado</span>
                  <span className="font-medium text-destructive">{formatCurrency(consolidadoSaidas)}</span>
                </div>
                <Progress value={pctSaidas} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{pctSaidas.toFixed(0)}% realizado</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ faturamento, entradas, saidas, saldo, previstoReceitas, previstoSaidas, consolidadoReceitas, consolidadoSaidas, loading }: SummaryCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>
      <ForecastSection
        previstoReceitas={previstoReceitas}
        previstoSaidas={previstoSaidas}
        consolidadoReceitas={consolidadoReceitas}
        consolidadoSaidas={consolidadoSaidas}
        loading={loading}
      />
    </div>
  );
}

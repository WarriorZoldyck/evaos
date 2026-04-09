import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Wallet, DollarSign, ArrowUpCircle, ArrowDownCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  faturamento: number;
  entradas: number;
  saidas: number;
  saldo: number;
  entradaPrevista: number;
  saidaPrevista: number;
  mdrBruto: number;
  mdrLiquido: number;
  mdrTaxas: number;
  mdrPercent: number;
  loading: boolean;
  dateFrom: string;
  dateTo: string;
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
  onClick?: () => void;
}

function SummaryCard({ title, value, icon: Icon, trend, gradient, loading, onClick }: CardItemProps) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-primary";

  return (
    <Card
      className="card-hover shadow-premium overflow-hidden relative group cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className={`text-xl font-bold font-display ${trendColor}`}>
                {formatCurrency(value)}
              </p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ForecastCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconClassName: string;
  valueClassName?: string;
  loading: boolean;
  onClick?: () => void;
  subtitle?: string;
}

function ForecastCard({ title, value, icon: Icon, iconClassName, valueClassName, loading, onClick, subtitle }: ForecastCardProps) {
  return (
    <Card className="cursor-pointer hover:border-primary/20 transition-colors" onClick={onClick}>
      <CardContent className="p-5 flex items-center gap-3">
        <Icon className={`h-8 w-8 shrink-0 ${iconClassName}`} />
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-6 w-24 mt-0.5" />
          ) : (
            <p className={`text-lg font-bold font-mono ${valueClassName || ""}`}>
              {formatCurrency(value)}
            </p>
          )}
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ faturamento, entradas, saidas, saldo, entradaPrevista, saidaPrevista, mdrBruto, mdrLiquido, mdrTaxas, mdrPercent, loading, dateFrom, dateTo }: SummaryCardsProps) {
  const navigate = useNavigate();

  const go = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    navigate(`/lancamentos?${sp.toString()}`);
  };

  const saldoPrevisto = entradaPrevista - saidaPrevista;

  return (
    <div className="space-y-4">
      {/* Main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Faturamento"
          value={faturamento}
          icon={DollarSign}
          trend="neutral"
          gradient="bg-gradient-primary"
          loading={loading}
          onClick={() => go({ type: "receita" })}
        />
        <SummaryCard
          title="Entradas"
          value={entradas}
          icon={TrendingUp}
          trend="up"
          gradient="bg-gradient-success"
          loading={loading}
          onClick={() => go({ type: "receita", status: "Pago" })}
        />
        <SummaryCard
          title="Saídas"
          value={saidas}
          icon={TrendingDown}
          trend="down"
          gradient="bg-gradient-destructive"
          loading={loading}
          onClick={() => go({ type: "despesa", status: "Pago" })}
        />
        <SummaryCard
          title="Saldo do Período"
          value={saldo}
          icon={Wallet}
          trend={saldo >= 0 ? "up" : "down"}
          gradient={saldo >= 0 ? "bg-gradient-success" : "bg-gradient-destructive"}
          loading={loading}
          onClick={() => go({})}
        />
      </div>

      {/* Forecast cards + MDR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ForecastCard
          title="Entradas previstas"
          value={entradaPrevista}
          icon={ArrowUpCircle}
          iconClassName="text-success"
          loading={loading}
          onClick={() => go({ type: "receita", status: "Pendente" })}
        />
        <ForecastCard
          title="Saídas previstas"
          value={saidaPrevista}
          icon={ArrowDownCircle}
          iconClassName="text-destructive"
          loading={loading}
          onClick={() => go({ type: "despesa", status: "Pendente" })}
        />
        <ForecastCard
          title="Saldo previsto"
          value={saldoPrevisto}
          icon={({ className }: { className?: string }) => (
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${saldoPrevisto >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <span className="text-sm font-bold">=</span>
            </div>
          )}
          iconClassName=""
          valueClassName={saldoPrevisto >= 0 ? "text-success" : "text-destructive"}
          loading={loading}
          onClick={() => go({ status: "Pendente" })}
        />
      </div>
    </div>
  );
}

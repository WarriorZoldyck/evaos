import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Wallet, DollarSign, ArrowUpCircle, ArrowDownCircle, Landmark, Percent, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface SeriesPoint { date: string; v: number }

interface SummaryCardsProps {
  faturamento: number;
  receitaOperacional?: number;
  unmappedRevenueCount?: number;
  faturamentoNaoMapeado?: number;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAtual: number;
  entradaPrevista: number;
  saidaPrevista: number;
  mdrBruto: number;
  mdrLiquido: number;
  mdrTaxas: number;
  mdrPercent: number;
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  // Comparativos vs período anterior + sparkline
  prevFaturamento?: number;
  prevEntradas?: number;
  prevSaidas?: number;
  prevSaldo?: number;
  prevEntradaPrevista?: number;
  prevSaidaPrevista?: number;
  prevSaldoPrevisto?: number;
  faturamentoSeries?: SeriesPoint[];
  entradasSeries?: SeriesPoint[];
  saidasSeries?: SeriesPoint[];
  saldoSeries?: SeriesPoint[];
  marginSeries?: SeriesPoint[];
  onFaturamentoClick?: () => void;
  internalTransfersTotal?: number;
}


function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function pctChange(curr: number, prev: number): number | null {
  if (!isFinite(prev) || prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

interface CardItemProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
  gradient: string;
  loading: boolean;
  onClick?: () => void;
  delta?: number | null;
  series?: SeriesPoint[];
  accent?: string;
  invertDeltaColor?: boolean; // for "saídas" where up = bad
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  trend,
  gradient,
  loading,
  onClick,
  delta,
  series,
  accent = "hsl(195, 100%, 50%)",
  invertDeltaColor = false,
}: CardItemProps) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-foreground";

  const isUp = (delta ?? 0) >= 0;
  const deltaGood = invertDeltaColor ? !isUp : isUp;
  const deltaColor =
    delta === null || delta === undefined
      ? "text-muted-foreground"
      : deltaGood
        ? "text-success"
        : "text-destructive";
  const gradId = `spark-${title.replace(/\W/g, "")}`;

  return (
    <Card
      className="card-hover shadow-premium overflow-hidden relative group cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4 relative z-10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className={`text-xl font-bold font-display ${trendColor}`}>
                {typeof value === "number" ? formatCurrency(value) : value}
              </p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        {(delta !== undefined || series) && (
          <div className="flex items-end justify-between gap-2 pt-1">
            <div className="text-[11px] flex items-center gap-1 min-w-0">
              {delta !== undefined && delta !== null ? (
                <>
                  <span className={deltaColor}>
                    {isUp ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground truncate">vs período anterior</span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            {series && series.length > 0 && (
              <div className="h-8 w-20 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={accent}
                      strokeWidth={1.5}
                      fill={`url(#${gradId})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
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
  delta?: number | null;
  invertDeltaColor?: boolean;
}

function ForecastCard({ title, value, icon: Icon, iconClassName, valueClassName, loading, onClick, subtitle, delta, invertDeltaColor }: ForecastCardProps) {
  const isUp = (delta ?? 0) >= 0;
  const deltaGood = invertDeltaColor ? !isUp : isUp;
  const deltaColor =
    delta === null || delta === undefined
      ? "text-muted-foreground"
      : deltaGood
        ? "text-success"
        : "text-destructive";

  return (
    <Card className="cursor-pointer hover:border-primary/20 transition-colors" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 shrink-0 ${iconClassName}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-6 w-24 mt-0.5" />
          ) : (
            <p className={`text-lg font-bold font-mono ${valueClassName || ""}`}>
              {formatCurrency(value)}
            </p>
          )}
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          {delta !== undefined && delta !== null && (
            <p className={`text-[10px] ${deltaColor} mt-0.5`}>
              {isUp ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}% vs período anterior
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  faturamento, receitaOperacional, unmappedRevenueCount = 0, faturamentoNaoMapeado = 0,
  entradas, saidas, saldo, saldoAtual,
  entradaPrevista, saidaPrevista, mdrBruto, mdrLiquido, mdrTaxas, mdrPercent,
  loading, dateFrom, dateTo,
  prevFaturamento, prevEntradas, prevSaidas, prevSaldo,
  prevEntradaPrevista, prevSaidaPrevista, prevSaldoPrevisto,
  faturamentoSeries, entradasSeries, saidasSeries, saldoSeries, marginSeries,
  onFaturamentoClick,
  internalTransfersTotal,
}: SummaryCardsProps) {
  const navigate = useNavigate();


  const go = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    navigate(`/lancamentos?${sp.toString()}`);
  };

  const saldoPrevisto = entradaPrevista - saidaPrevista;
  const margin = entradas > 0 ? ((entradas - saidas) / entradas) * 100 : 0;
  const prevMargin =
    prevEntradas !== undefined && prevSaidas !== undefined && prevEntradas > 0
      ? ((prevEntradas - prevSaidas) / prevEntradas) * 100
      : null;
  const marginDelta = prevMargin === null ? null : margin - prevMargin;

  return (
    <div className="space-y-4">
      {/* Main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard
          title="Saldo Atual"
          value={saldoAtual}
          icon={Landmark}
          trend={saldoAtual >= 0 ? "up" : "down"}
          gradient={saldoAtual >= 0 ? "bg-gradient-primary" : "bg-gradient-destructive"}
          loading={loading}
          accent="hsl(195, 100%, 50%)"
        />
        <SummaryCard
          title="Faturamento"
          value={faturamento}
          icon={DollarSign}
          trend="neutral"
          gradient="bg-gradient-primary"
          loading={loading}
          onClick={onFaturamentoClick ?? (() => go({ type: "receita" }))}
          delta={prevFaturamento !== undefined ? pctChange(faturamento, prevFaturamento) : undefined}
          series={faturamentoSeries}
          accent="hsl(195, 100%, 50%)"
        />
        <SummaryCard
          title="Entradas"
          value={entradas}
          icon={TrendingUp}
          trend="up"
          gradient="bg-gradient-success"
          loading={loading}
          onClick={() => go({ type: "receita", status: "Pago" })}
          delta={prevEntradas !== undefined ? pctChange(entradas, prevEntradas) : undefined}
          series={entradasSeries}
          accent="hsl(142, 71%, 45%)"
        />
        <SummaryCard
          title="Saídas"
          value={saidas}
          icon={TrendingDown}
          trend="down"
          gradient="bg-gradient-destructive"
          loading={loading}
          onClick={() => go({ type: "despesa", status: "Pago" })}
          delta={prevSaidas !== undefined ? pctChange(saidas, prevSaidas) : undefined}
          series={saidasSeries}
          accent="hsl(0, 72%, 55%)"
          invertDeltaColor
        />
        <SummaryCard
          title="Saldo do Período"
          value={saldo}
          icon={Wallet}
          trend={saldo >= 0 ? "up" : "down"}
          gradient={saldo >= 0 ? "bg-gradient-success" : "bg-gradient-destructive"}
          loading={loading}
          onClick={() => go({})}
          delta={prevSaldo !== undefined ? pctChange(saldo, prevSaldo) : undefined}
          series={saldoSeries}
          accent={saldo >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 55%)"}
        />
        <SummaryCard
          title="Margem"
          value={`${margin.toFixed(1)}%`}
          icon={Percent}
          trend={margin >= 0 ? "up" : "down"}
          gradient="bg-gradient-primary"
          loading={loading}
          delta={marginDelta}
          series={marginSeries}
          accent="hsl(265, 80%, 60%)"
        />
      </div>

      {/* Aviso de transferências internas excluídas do dashboard/DRE */}
      {!loading && (internalTransfersTotal ?? 0) > 0 && (
        <TooltipProvider>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-muted/40 text-xs text-muted-foreground">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {formatCurrency(internalTransfersTotal ?? 0)} em transferências entre contas próprias foram excluídas dos totais.
            </span>
            <UITooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground hover:bg-muted"
                  aria-label="Por que está excluído?"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Transferências entre contas próprias não são receita nem despesa — é o mesmo dinheiro mudando de conta. Por isso ficam de fora do Dashboard e do DRE, mas continuam visíveis na tela de Lançamentos.
              </TooltipContent>
            </UITooltip>
          </div>
        </TooltipProvider>
      )}



      {/* Forecast cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ForecastCard
          title="Entradas previstas"
          value={entradaPrevista}
          icon={ArrowUpCircle}
          iconClassName="text-success"
          loading={loading}
          onClick={() => go({ type: "receita", status: "Pendente" })}
          delta={prevEntradaPrevista !== undefined ? pctChange(entradaPrevista, prevEntradaPrevista) : undefined}
        />
        <ForecastCard
          title="Saídas previstas"
          value={saidaPrevista}
          icon={ArrowDownCircle}
          iconClassName="text-destructive"
          loading={loading}
          onClick={() => go({ type: "despesa", status: "Pendente" })}
          delta={prevSaidaPrevista !== undefined ? pctChange(saidaPrevista, prevSaidaPrevista) : undefined}
          invertDeltaColor
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
          delta={prevSaldoPrevisto !== undefined ? pctChange(saldoPrevisto, prevSaldoPrevisto) : undefined}
        />
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import {
  dailySeries,
  sumInRange,
  getPreviousPeriodRange,
  pctChange,
} from "@/lib/dashboardInsights";

interface Tx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
}

interface Props {
  allTransactions: Tx[];
  start: Date;
  end: Date;
  entradas: number;
  saidas: number;
  saldo: number;
  loading: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

interface HeroCardProps {
  label: string;
  value: string;
  delta: number | null;
  series: { date: string; v: number }[];
  accent: string;
  Icon: any;
  variant?: "area" | "bar";
  loading: boolean;
}

function HeroCard({ label, value, delta, series, accent, Icon, variant = "area", loading }: HeroCardProps) {
  const isUp = (delta ?? 0) >= 0;
  const deltaColor =
    delta === null
      ? "text-muted-foreground"
      : isUp
        ? "text-success"
        : "text-destructive";
  const gradId = `g-${accent.replace(/[^a-z0-9]/gi, "")}-${label.replace(/\W/g, "")}`;

  return (
    <Card className="shadow-premium overflow-hidden relative">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <span
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: accent }}
          >
            {label}
          </span>
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shadow-md"
            style={{ background: accent }}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-8 w-32 mb-2" />
        ) : (
          <p className="text-2xl font-bold font-display text-foreground">{value}</p>
        )}

        <div className="flex items-end justify-between gap-3 mt-2">
          <div className="text-xs flex items-center gap-1">
            {delta !== null && (
              <>
                <span className={deltaColor}>
                  {isUp ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs mês passado</span>
              </>
            )}
            {delta === null && (
              <span className="text-muted-foreground">vs mês passado</span>
            )}
          </div>
          <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              {variant === "area" ? (
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
                    strokeWidth={1.8}
                    fill={`url(#${gradId})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart data={series}>
                  <Bar dataKey="v" fill={accent} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HeroSummaryCards({
  allTransactions,
  start,
  end,
  entradas,
  saidas,
  saldo,
  loading,
}: Props) {
  const prev = useMemo(() => getPreviousPeriodRange(start, end), [start, end]);

  const prevEntradas = useMemo(
    () => sumInRange(allTransactions, prev.start, prev.end, (t) => t.type === "receita"),
    [allTransactions, prev],
  );
  const prevSaidas = useMemo(
    () => sumInRange(allTransactions, prev.start, prev.end, (t) => t.type === "despesa"),
    [allTransactions, prev],
  );
  const prevSaldo = prevEntradas - prevSaidas;
  const prevMargin = prevEntradas > 0 ? ((prevEntradas - prevSaidas) / prevEntradas) * 100 : 0;

  const margin = entradas > 0 ? ((entradas - saidas) / entradas) * 100 : 0;

  const entradasSeries = useMemo(
    () =>
      dailySeries(
        allTransactions,
        start,
        end,
        (t) => (t.type === "receita" ? Number(t.amount) : 0),
      ),
    [allTransactions, start, end],
  );
  const saidasSeries = useMemo(
    () =>
      dailySeries(
        allTransactions,
        start,
        end,
        (t) => (t.type === "despesa" ? Number(t.amount) : 0),
      ),
    [allTransactions, start, end],
  );
  const resultadoSeries = useMemo(
    () =>
      dailySeries(allTransactions, start, end, (t) =>
        t.type === "receita" ? Number(t.amount) : -Number(t.amount),
      ),
    [allTransactions, start, end],
  );
  const marginSeries = useMemo(
    () =>
      entradasSeries.map((e, i) => {
        const sv = saidasSeries[i]?.v || 0;
        const total = e.v;
        return { date: e.date, v: total > 0 ? ((total - sv) / total) * 100 : 0 };
      }),
    [entradasSeries, saidasSeries],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <HeroCard
        label="RECEITAS"
        value={fmt(entradas)}
        delta={pctChange(entradas, prevEntradas)}
        series={entradasSeries}
        accent="hsl(142, 71%, 45%)"
        Icon={TrendingUp}
        variant="area"
        loading={loading}
      />
      <HeroCard
        label="DESPESAS"
        value={fmt(saidas)}
        delta={pctChange(saidas, prevSaidas)}
        series={saidasSeries}
        accent="hsl(0, 72%, 55%)"
        Icon={TrendingDown}
        variant="area"
        loading={loading}
      />
      <HeroCard
        label="RESULTADO"
        value={fmt(saldo)}
        delta={pctChange(saldo, prevSaldo)}
        series={resultadoSeries}
        accent="hsl(195, 90%, 50%)"
        Icon={Wallet}
        variant="bar"
        loading={loading}
      />
      <HeroCard
        label="MARGEM"
        value={`${margin.toFixed(1)}%`}
        delta={margin - prevMargin}
        series={marginSeries}
        accent="hsl(265, 80%, 60%)"
        Icon={Percent}
        variant="area"
        loading={loading}
      />
    </div>
  );
}

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, Receipt, TrendingDown, ExternalLink } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useMdrSummary } from "@/hooks/useMdrSummary";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MdrDetailModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const {
    loading,
    currentMonth,
    ytd,
    monthlySeries,
    byTerminal,
    byModality,
    selectedYm,
    setSelectedYm,
  } = useMdrSummary();

  const monthOptions = useMemo(() => monthlySeries.slice().reverse(), [monthlySeries]);
  const selected = monthlySeries.find((m) => m.ym === selectedYm) || currentMonth;
  const ticketMedio = selected.count > 0 ? selected.net / selected.count : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-destructive" />
            MDR — Taxas de Maquininha
          </DialogTitle>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mês de referência</span>
            <Select value={selectedYm} onValueChange={setSelectedYm}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.ym} value={m.ym}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <span className="text-[11px] text-muted-foreground underline decoration-dotted cursor-help">
                  Como o MDR é calculado?
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Para cada venda no terminal, usamos a taxa configurada na maquininha
                (débito, crédito à vista ou parcelado N×). MDR = valor bruto × taxa.
                Quando a liquidação já registrou bruto e líquido, usamos a diferença real.
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="MDR no mês"
            icon={TrendingDown}
            value={loading ? null : fmt(selected.fee)}
            sub={!loading ? `${selected.count} vendas` : undefined}
            tone="destructive"
          />
          <Kpi
            label="Bruto no mês"
            icon={Receipt}
            value={loading ? null : fmt(selected.gross)}
            sub={!loading ? `Líquido ${fmt(selected.net)}` : undefined}
          />
          <Kpi
            label="Taxa efetiva"
            icon={Percent}
            value={loading ? null : fmtPct(selected.effectiveRate)}
            sub={!loading ? `Ticket médio ${fmt(ticketMedio)}` : undefined}
          />
          <Kpi
            label="MDR no ano"
            icon={TrendingDown}
            value={loading ? null : fmt(ytd.fee)}
            sub={!loading ? `${fmtPct(ytd.effectiveRate)} sobre ${fmt(ytd.gross)}` : undefined}
            tone="destructive"
          />
        </div>

        {/* Chart 12 months */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-2">Últimos 12 meses</p>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis
                      yAxisId="left"
                      fontSize={11}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      fontSize={11}
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                    />
                    <RTooltip
                      formatter={(value: any, name: string) => {
                        if (name === "Taxa efetiva") return [`${Number(value).toFixed(2)}%`, name];
                        return [fmt(Number(value)), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="fee"
                      name="MDR"
                      fill="hsl(0, 72%, 55%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="effectiveRate"
                      name="Taxa efetiva"
                      stroke="hsl(195, 100%, 50%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Por maquininha
                </p>
                <span className="text-[10px] text-muted-foreground">mês selecionado</span>
              </div>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : byTerminal.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Sem vendas em maquininha neste mês.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5 font-normal">Terminal</th>
                        <th className="text-right py-1.5 font-normal">Bruto</th>
                        <th className="text-right py-1.5 font-normal">MDR</th>
                        <th className="text-right py-1.5 font-normal">Taxa</th>
                        <th className="text-right py-1.5 font-normal">Vendas</th>
                        <th className="text-right py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {byTerminal.map((t) => (
                        <tr key={t.terminalId} className="border-b border-border/40">
                          <td className="py-1.5">
                            <div className="font-medium">{t.terminalName}</div>
                            {t.acquirer && (
                              <div className="text-[10px] text-muted-foreground">{t.acquirer}</div>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{fmt(t.gross)}</td>
                          <td className="text-right tabular-nums text-destructive">
                            -{fmt(t.fee)}
                          </td>
                          <td className="text-right tabular-nums">{fmtPct(t.effectiveRate)}</td>
                          <td className="text-right tabular-nums">{t.count}</td>
                          <td className="text-right">
                            {t.terminalId !== "unknown" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  const [y, m] = selectedYm.split("-");
                                  const lastDay = new Date(Number(y), Number(m), 0).getDate();
                                  const sp = new URLSearchParams({
                                    dateFrom: `${selectedYm}-01`,
                                    dateTo: `${selectedYm}-${String(lastDay).padStart(2, "0")}`,
                                    cardTerminalId: t.terminalId,
                                  });
                                  onOpenChange(false);
                                  navigate(`/lancamentos?${sp.toString()}`);
                                }}
                                aria-label="Ver lançamentos"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Por modalidade
                </p>
                <span className="text-[10px] text-muted-foreground">mês selecionado</span>
              </div>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : byModality.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Sem vendas no período.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-1.5 font-normal">Modalidade</th>
                      <th className="text-right py-1.5 font-normal">Bruto</th>
                      <th className="text-right py-1.5 font-normal">MDR</th>
                      <th className="text-right py-1.5 font-normal">Taxa</th>
                      <th className="text-right py-1.5 font-normal">Vendas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byModality.map((m) => (
                      <tr key={m.modality} className="border-b border-border/40">
                        <td className="py-1.5 font-medium">{m.modality}</td>
                        <td className="text-right tabular-nums">{fmt(m.gross)}</td>
                        <td className="text-right tabular-nums text-destructive">-{fmt(m.fee)}</td>
                        <td className="text-right tabular-nums">{fmtPct(m.effectiveRate)}</td>
                        <td className="text-right tabular-nums">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | null;
  sub?: string;
  icon: React.ElementType;
  tone?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <Icon className={`h-3.5 w-3.5 ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        {value === null ? (
          <Skeleton className="h-6 w-24 mt-1" />
        ) : (
          <p className={`text-lg font-bold font-display mt-0.5 ${tone === "destructive" ? "text-destructive" : ""}`}>
            {value}
          </p>
        )}
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

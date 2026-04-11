import { Card, CardContent } from "@/components/ui/card";
import { Building2, Home, TrendingDown, Clock, DollarSign, LayoutGrid, CalendarDays } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CostGroupTotals } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CostSummaryCardsProps {
  groupTotals: CostGroupTotals;
  custoHora: number;
  fmm: number;
  fmmPorSala: number;
  custoHoraPorSala: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

export function CostSummaryCards({ groupTotals, custoHora, fmm, fmmPorSala, custoHoraPorSala }: CostSummaryCardsProps) {
  const pieData = [
    { name: "Fixos Clínica", value: groupTotals.fixos_clinica },
    { name: "Variáveis Clínica", value: groupTotals.variaveis_clinica },
    { name: "Pessoais", value: groupTotals.pessoais },
  ].filter((d) => d.value > 0);

  const fmmAnual = fmm * 12;

  const summaryItems = [
    { label: "Fixos Clínica", value: groupTotals.fixos_clinica, icon: Building2, color: "text-primary" },
    { label: "Variáveis Clínica", value: groupTotals.variaveis_clinica, icon: TrendingDown, color: "text-chart-2" },
    { label: "Pessoais (Casa)", value: groupTotals.pessoais, icon: Home, color: "text-chart-3" },
  ];

  const metricItems = [
    { label: "Custo / Hora", value: custoHora, icon: Clock },
    { label: "FMM (Fat. Mín. Mensal)", value: fmm, icon: DollarSign },
    { label: "FMM / Sala", value: fmmPorSala, icon: LayoutGrid },
    { label: "CF/H / Sala", value: custoHoraPorSala, icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Group totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-muted ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold font-display">{fmt(item.value)}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(item.value * 12)}/ano</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Annual minimum billing highlight */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento Mínimo Anual</p>
              <p className="text-xl font-bold font-display text-primary">{fmt(fmmAnual)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Mês</p>
            <p className="text-lg font-bold font-display">{fmt(fmm)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Metrics + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metricItems.map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 text-center">
                <m.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold font-display">{fmt(m.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {pieData.length > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

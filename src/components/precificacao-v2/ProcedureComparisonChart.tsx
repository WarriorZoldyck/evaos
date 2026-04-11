import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedures: ProcedureV2[];
  calcProcedure: (proc: ProcedureV2) => {
    cf: number; cv: number; nf: number; liquido: number; lucro: number;
    lucratividadeHora: number; lucratividadePct: number; lucratividadeHoraTotal: number;
  };
}

export function ProcedureComparisonChart({ procedures, calcProcedure }: Props) {
  if (procedures.length < 2) return null;

  const data = procedures.map((proc) => {
    const calc = calcProcedure(proc);
    return {
      name: proc.name.length > 18 ? proc.name.slice(0, 16) + "…" : proc.name,
      fullName: proc.name,
      preco: proc.desired_price,
      cf: calc.cf,
      cv: calc.cv,
      nf: calc.nf,
      lucro: calc.lucro,
      lucroHora: calc.lucratividadeHora,
      lucroPct: calc.lucratividadePct,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Comparativo de Procedimentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stacked cost breakdown */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Composição de custos por procedimento</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1).toFixed(0)}`} fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend fontSize={11} />
                <Bar dataKey="cf" name="Custo Fixo" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="cv" name="Custo Variável" stackId="a" fill="hsl(var(--chart-2))" />
                <Bar dataKey="nf" name="Imposto" stackId="a" fill="hsl(var(--chart-3))" />
                <Bar dataKey="lucro" name="Lucro" stackId="a" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profitability per hour */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Lucratividade por hora (R$/h)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} angle={-15} textAnchor="end" height={50} />
                <YAxis tickFormatter={(v) => `R$${v}`} fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [fmt(value), "Lucro/h"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="lucroHora" name="Lucro/h" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.lucroHora >= 0 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

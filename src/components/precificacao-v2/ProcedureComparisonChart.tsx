import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedures: ProcedureV2[];
  calcProcedure: (proc: ProcedureV2) => {
    cf: number; cv: number; nf: number; liquido: number; lucro: number;
    lucratividadeHora: number; lucratividadePct: number;
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

  const COLORS = {
    cf: "#ef4444",     // red-500 — custo fixo
    cv: "#f87171",     // red-400 — custo variável
    nf: "#f59e0b",     // amber-500 — imposto
    lucro: "#22c55e",  // green-500 — lucro
  };

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
              <BarChart data={data} margin={{ left: 10, right: 20, bottom: 20 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `R$${v.toFixed(0)}`} fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend fontSize={11} />
                <Bar dataKey="cf" name="Custo Fixo" stackId="a" fill={COLORS.cf} />
                <Bar dataKey="cv" name="Custo Variável" stackId="a" fill={COLORS.cv} />
                <Bar dataKey="nf" name="Imposto" stackId="a" fill={COLORS.nf} />
                <Bar dataKey="lucro" name="Lucro" stackId="a" fill={COLORS.lucro} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profitability per hour */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Lucratividade por hora (R$/h)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ left: 10, right: 20 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} angle={-15} textAnchor="end" height={50} />
                <YAxis tickFormatter={(v) => `R$${v}`} fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [fmt(value), "Lucro/h"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="lucroHora" name="Lucro/h" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.lucroHora >= 0 ? COLORS.lucro : COLORS.cf}
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

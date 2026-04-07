import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart3, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface DREIndicatorCardsProps {
  receitaOperacional: Record<string, number>;
  lucroBruto: Record<string, number>;
  lucroLiquido: Record<string, number>;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function DREIndicatorCards({ receitaOperacional, lucroBruto, lucroLiquido }: DREIndicatorCardsProps) {
  const totalReceita = Object.values(receitaOperacional).reduce((s, v) => s + v, 0);
  const totalBruto = Object.values(lucroBruto).reduce((s, v) => s + v, 0);
  const totalLiquido = Object.values(lucroLiquido).reduce((s, v) => s + v, 0);

  const margemBruta = totalReceita > 0 ? (totalBruto / totalReceita) * 100 : 0;
  const margemLiquida = totalReceita > 0 ? (totalLiquido / totalReceita) * 100 : 0;
  const lucratividade = totalReceita > 0 ? (totalLiquido / totalReceita) * 100 : 0;

  const cards = [
    {
      label: "Receita Operacional",
      value: fmt(totalReceita),
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Margem Bruta",
      value: fmtPct(margemBruta),
      subtitle: fmt(totalBruto),
      icon: Target,
      color: margemBruta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
    },
    {
      label: "Margem Líquida",
      value: fmtPct(margemLiquida),
      subtitle: fmt(totalLiquido),
      icon: margemLiquida >= 0 ? TrendingUp : TrendingDown,
      color: margemLiquida >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
    },
    {
      label: "Lucratividade",
      value: fmtPct(lucratividade),
      icon: lucratividade >= 0 ? TrendingUp : TrendingDown,
      color: lucratividade >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={cn("h-4 w-4", c.color)} />
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
            <p className={cn("text-lg font-bold", c.color)}>{c.value}</p>
            {c.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

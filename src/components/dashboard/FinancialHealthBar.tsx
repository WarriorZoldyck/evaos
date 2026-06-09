import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Target, PiggyBank, CalendarCheck2 } from "lucide-react";

interface Tx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
}

interface Props {
  entradas: number;
  saidas: number;
  saldo: number;
  prevEntradas: number;
  prevSaidas: number;
  transactions: Tx[];
  loading: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function scoreLabel(score: number) {
  if (score >= 80) return { label: "Excelente", color: "text-success" };
  if (score >= 60) return { label: "Boa", color: "text-success" };
  if (score >= 40) return { label: "Regular", color: "text-warning" };
  return { label: "Atenção", color: "text-destructive" };
}

export function FinancialHealthBar({
  entradas,
  saidas,
  saldo,
  prevEntradas,
  prevSaidas,
  transactions,
  loading,
}: Props) {
  const metrics = useMemo(() => {
    // Score (0-100): saving rate + expense control vs revenue
    const savingRate = entradas > 0 ? Math.max(0, (entradas - saidas) / entradas) : 0;
    const expenseGrowth =
      prevSaidas > 0 ? (saidas - prevSaidas) / prevSaidas : 0;
    let score = 50;
    score += savingRate * 50; // up to +50 for 100% saving
    score -= Math.max(0, expenseGrowth) * 30; // penalize expense growth
    if (saldo < 0) score -= 15;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Gastos sob controle: % de despesas que não cresceram vs mês passado
    const controlPct = prevSaidas > 0
      ? Math.max(0, Math.min(100, 100 - (expenseGrowth * 100)))
      : 100;

    // Economia potencial: 10% das maiores despesas
    const paidExpenses = transactions
      .filter((t) => t.status === "Pago" && t.type === "despesa")
      .map((t) => Number(t.amount))
      .sort((a, b) => b - a);
    const topExpenses = paidExpenses.slice(0, 5).reduce((a, b) => a + b, 0);
    const potentialSavings = topExpenses * 0.1;

    // Planejamento: % do mês concluído
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgress = Math.round((now.getDate() / daysInMonth) * 100);

    return { score, controlPct: Math.round(controlPct), potentialSavings, monthProgress };
  }, [entradas, saidas, saldo, prevSaidas, transactions]);

  const { label, color } = scoreLabel(metrics.score);
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (metrics.score / 100) * circumference;

  if (loading) {
    return <Skeleton className="h-28 w-full" />;
  }

  return (
    <Card className="shadow-premium bg-gradient-to-r from-success/5 via-card to-primary/5 border-success/20">
      <CardContent className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="6"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-display">{metrics.score}</span>
                <span className="text-[9px] text-muted-foreground -mt-1">/100</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold">Saúde Financeira</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full bg-success/10 ${color}`}
                >
                  {label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                {metrics.score >= 60
                  ? "Você está com as finanças sob controle. Continue assim!"
                  : "Há espaço para melhorar — reveja suas despesas."}
              </p>
            </div>
          </div>

          {/* Gastos sob controle */}
          <div className="flex items-center gap-3 md:border-l md:border-border md:pl-5">
            <Target className="h-7 w-7 text-success shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Gastos sob controle</p>
              <p className="text-lg font-bold font-display">{metrics.controlPct}%</p>
              <p className="text-[10px] text-success">
                {metrics.controlPct >= 80 ? "Ótimo" : metrics.controlPct >= 50 ? "Bom" : "Atenção"}
              </p>
            </div>
          </div>

          {/* Economia potencial */}
          <div className="flex items-center gap-3 md:border-l md:border-border md:pl-5">
            <PiggyBank className="h-7 w-7 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Economia potencial</p>
              <p className="text-lg font-bold font-display">{fmt(metrics.potentialSavings)}</p>
              <p className="text-[10px] text-muted-foreground">Neste mês</p>
            </div>
          </div>

          {/* Planejamento */}
          <div className="flex items-center gap-3 md:border-l md:border-border md:pl-5">
            <CalendarCheck2 className="h-7 w-7 text-warning shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Planejamento</p>
              <p className="text-lg font-bold font-display">{metrics.monthProgress}%</p>
              <p className="text-[10px] text-muted-foreground">Do mês concluído</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

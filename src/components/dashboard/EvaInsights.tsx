import { useMemo } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, Info, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface Tx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
}

interface Insight {
  kind: "warning" | "info" | "success";
  title: string;
  detail: string;
}

interface Props {
  transactions: Tx[];
  allTransactions: Tx[];
  entradas: number;
  saidas: number;
  prevEntradas: number;
  prevSaidas: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function EvaInsights({
  transactions,
  entradas,
  saidas,
  prevEntradas,
  prevSaidas,
}: Props) {
  const navigate = useNavigate();

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    // Regex para detectar UUIDs (categoria não resolvida)
    const isUuid = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || "");

    // Per-category comparison: this period vs previous period (only on transactions current)
    const expenseByCat = new Map<string, number>();
    transactions
      .filter((t) => t.type === "despesa" && t.status === "Pago")
      .forEach((t) => {
        const name = !t.category || isUuid(t.category) ? "Sem categoria" : t.category;
        expenseByCat.set(name, (expenseByCat.get(name) || 0) + Number(t.amount));
      });

    // Biggest category warning (ignora "Sem categoria")
    const sortedCats = [...expenseByCat.entries()]
      .filter(([n]) => n !== "Sem categoria")
      .sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0 && saidas > 0) {
      const [topName, topVal] = sortedCats[0];
      const pct = (topVal / saidas) * 100;
      if (pct > 25) {
        list.push({
          kind: "warning",
          title: `Gasto com ${topName} acima do habitual`,
          detail: `Representa ${pct.toFixed(0)}% das suas despesas no período.`,
        });
      }
    }

    // Resultado positivo vs mês passado
    const resultado = entradas - saidas;
    const prevResultado = prevEntradas - prevSaidas;
    if (resultado > 0 && resultado > prevResultado && prevResultado !== 0) {
      const delta = ((resultado - prevResultado) / Math.abs(prevResultado)) * 100;
      list.push({
        kind: "success",
        title: "Parabéns! Resultado positivo",
        detail: `Você teve um resultado ${delta.toFixed(0)}% melhor que no mês passado.`,
      });
    } else if (resultado < 0) {
      list.push({
        kind: "warning",
        title: "Resultado negativo no período",
        detail: `Despesas superam receitas em ${fmt(Math.abs(resultado))}.`,
      });
    }

    // Despesas reduzidas vs mês passado
    if (prevSaidas > 0 && saidas < prevSaidas) {
      const delta = ((prevSaidas - saidas) / prevSaidas) * 100;
      list.push({
        kind: "info",
        title: "Ótimo controle de despesas!",
        detail: `Seus gastos estão ${delta.toFixed(0)}% menores que no mês passado.`,
      });
    }

    // Pendentes alert
    const pendentes = transactions.filter((t) => t.status === "Pendente");
    if (pendentes.length > 5) {
      list.push({
        kind: "info",
        title: `${pendentes.length} lançamentos pendentes`,
        detail: "Confira e liquide as transações em aberto.",
      });
    }

    return list.slice(0, 4);
  }, [transactions, entradas, saidas, prevEntradas, prevSaidas]);

  return (
    <Card className="shadow-premium">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Insights da EVA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sem insights no momento. Continue registrando suas transações.
          </p>
        ) : (
          insights.map((ins, i) => {
            const Icon =
              ins.kind === "warning"
                ? AlertTriangle
                : ins.kind === "success"
                  ? CheckCircle2
                  : Info;
            const color =
              ins.kind === "warning"
                ? "text-warning"
                : ins.kind === "success"
                  ? "text-success"
                  : "text-primary";
            const bg =
              ins.kind === "warning"
                ? "bg-warning/10 border-warning/20"
                : ins.kind === "success"
                  ? "bg-success/10 border-success/20"
                  : "bg-primary/10 border-primary/20";
            return (
              <button
                key={i}
                onClick={() => navigate("/lancamentos")}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border ${bg} text-left hover:opacity-90 transition`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${color}`}>{ins.title}</p>
                  <p className="text-xs text-muted-foreground">{ins.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

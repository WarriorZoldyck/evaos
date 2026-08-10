import { useMemo, useState } from "react";
import { Calculator, Sparkles, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/goalPlanning";
import {
  simulateSavings,
  deadlineFromMonths,
  type SimulatorCategory,
} from "@/lib/savingsSimulator";

interface Props {
  categories: SimulatorCategory[];
  loading?: boolean;
  onCreateGoal: (draft: {
    name: string;
    target: number;
    deadline: string;
    monthly: number;
  }) => void;
}

export function SavingsSimulator({ categories, loading, onCreateGoal }: Props) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [months, setMonths] = useState("12");
  const [cuts, setCuts] = useState<Record<string, number>>({});

  const top = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total).slice(0, 6),
    [categories],
  );

  const result = useMemo(
    () =>
      simulateSavings({
        targetAmount: Number(target) || 0,
        months: Number(months) || 1,
        categories: top,
        cuts: top.map((c) => ({ name: c.name, percent: cuts[c.name] ?? 0 })),
      }),
    [target, months, top, cuts],
  );

  const canCreate = Number(target) > 0;

  if (loading) {
    return <Skeleton className="h-[420px] w-full rounded-[1.5rem]" />;
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Calculator className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Simulador de economia</h3>
          <p className="text-xs text-muted-foreground">
            Corte nas suas saídas e veja a meta nascer
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Nome da meta (opcional)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reserva de emergência"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Quanto juntar</Label>
          <Input
            type="number"
            min={0}
            step={100}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="10000"
            className="h-9 font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Em quantos meses</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="h-9 font-mono"
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-3 space-y-1",
          result.feasible
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-destructive/30 bg-destructive/10",
        )}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Precisa guardar / mês</span>
          <span className="font-mono font-semibold text-foreground">
            {formatBRL(result.requiredMonthly)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Economia simulada / mês</span>
          <span
            className={cn(
              "font-mono font-semibold",
              result.feasible ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {formatBRL(result.simulatedMonthly)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              result.feasible ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${Math.min(100, result.coverage * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          {result.feasible
            ? "Os cortes cobrem o aporte necessário."
            : `Faltam ${formatBRL(Math.max(0, result.missingMonthly))} por mês.`}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3" /> Onde cortar
        </p>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem despesas categorizadas neste ano para simular.
          </p>
        ) : (
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {result.lines.map((line) => (
              <div key={line.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{line.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {formatBRL(line.monthlyAvg)}/mês
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[line.percent]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) =>
                      setCuts((prev) => ({ ...prev, [line.name]: v }))
                    }
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-xs font-mono text-muted-foreground">
                    {line.percent}%
                  </span>
                </div>
                {line.monthlySaving > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    + {formatBRL(line.monthlySaving)}/mês
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        className="w-full gap-2"
        disabled={!canCreate}
        onClick={() =>
          onCreateGoal({
            name: name.trim() || "Nova meta",
            target: Number(target) || 0,
            deadline: deadlineFromMonths(Number(months) || 1),
            monthly: Math.round(result.simulatedMonthly * 100) / 100,
          })
        }
      >
        <Sparkles className="h-4 w-4" />
        Criar meta com esse plano
      </Button>
    </div>
  );
}

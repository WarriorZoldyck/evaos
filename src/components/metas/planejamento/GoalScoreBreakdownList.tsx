import { formatBRL, type GoalScoreBreakdown } from "@/lib/goalPlanning";

interface Props {
  breakdown: GoalScoreBreakdown;
}

export function GoalScoreBreakdownList({ breakdown }: Props) {
  const rows: { label: string; value: string; hint?: string }[] = [
    {
      label: "Já acumulado",
      value: formatBRL(breakdown.accumulated),
    },
    {
      label: "Falta acumular",
      value: formatBRL(breakdown.remainingAmount),
    },
    {
      label: "Meses restantes",
      value: breakdown.monthsRemaining === null ? "sem prazo" : String(breakdown.monthsRemaining),
    },
    {
      label: "Aporte necessário / mês",
      value:
        breakdown.requiredContribution === null
          ? "—"
          : formatBRL(breakdown.requiredContribution),
    },
    {
      label:
        breakdown.contributionSource === "PLANEJADO"
          ? "Aporte planejado / mês"
          : "Capacidade mensal estimada",
      value: formatBRL(breakdown.effectiveContribution),
      hint:
        breakdown.contributionSource === "CAPACIDADE"
          ? "Sem aporte planejado — usando sua capacidade estimada."
          : `Capacidade estimada: ${formatBRL(breakdown.monthlyCapacity)}`,
    },
    {
      label: "Distância",
      value:
        breakdown.capacityGap === null
          ? "—"
          : `${breakdown.capacityGap >= 0 ? "+" : "−"}${formatBRL(Math.abs(breakdown.capacityGap))}`,
    },
  ];

  return (
    <dl className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="text-muted-foreground min-w-0 truncate" title={r.hint}>
            {r.label}
          </dt>
          <dd className="font-mono font-medium text-foreground shrink-0">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

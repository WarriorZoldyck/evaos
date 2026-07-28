import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingDown, CalendarClock, PiggyBank, AlertTriangle, Sparkles } from "lucide-react";
import { useMetasSidebarStats } from "@/hooks/useMetasSidebarStats";
import { useCompany } from "@/contexts/CompanyContext";
import { ActionPlanDialog } from "./ActionPlanDialog";
import type { Goal } from "@/hooks/useGoals";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MetasSidebarProps {
  goals: Goal[];
}

export function MetasSidebar({ goals }: MetasSidebarProps) {
  const { isPersonal } = useCompany();
  const stats = useMetasSidebarStats();
  const [planOpen, setPlanOpen] = useState(false);

  // Compromisso total das metas ativas (o que falta guardar em cada uma)
  const goalsRemaining = goals.reduce(
    (s, g) => s + Math.max(0, Number(g.target_amount) - Number(g.current_amount)),
    0,
  );
  const gap = Math.max(0, goalsRemaining - stats.leftover);
  const hasDeficit = stats.leftover <= 0 || gap > 0;

  return (
    <aside className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Visão do contexto
        </h2>
        <p className="text-xs text-muted-foreground px-1 mt-0.5">
          {isPersonal ? "Pessoal" : "Empresa"}
        </p>
      </div>

      {stats.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Saldo total"
            value={fmt(stats.totalBalance)}
            tone="primary"
          />
          <StatCard
            icon={<TrendingDown className="h-4 w-4" />}
            label={`Gasto acumulado ${new Date().getFullYear()}`}
            value={fmt(stats.spentYear)}
          />
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Projeção de saídas do ano"
            value={fmt(stats.projectedYearOut)}
          />
          <StatCard
            icon={<PiggyBank className="h-4 w-4" />}
            label="Sobra estimada"
            value={fmt(stats.leftover)}
            tone={stats.leftover < 0 ? "danger" : "success"}
          />

          {hasDeficit && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {stats.leftover < 0 ? "Não vai sobrar" : "Suas metas não cabem na sobra"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Faltam <strong className="text-destructive">{fmt(Math.max(gap, Math.abs(Math.min(0, stats.leftover))))}</strong> para fechar o ano com folga.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 border-destructive/40 hover:bg-destructive/10"
                  onClick={() => setPlanOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ver plano de ação
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ActionPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        gap={Math.max(gap, Math.abs(Math.min(0, stats.leftover)))}
        topCategories={stats.topCategories}
      />
    </aside>
  );
}

function StatCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "primary" | "danger" | "success";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <p className={`text-xl font-bold font-mono ${toneClasses}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

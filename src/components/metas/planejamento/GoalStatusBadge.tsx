import { cn } from "@/lib/utils";
import { STATUS_LABEL, type GoalStatus } from "@/lib/goalPlanning";

const STYLES: Record<GoalStatus, string> = {
  CONCLUIDA: "bg-primary/15 text-primary border-primary/30",
  ATINGIVEL: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  ATINGIVEL_COM_AJUSTES: "bg-primary/10 text-primary border-primary/25",
  EM_RISCO: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  NAO_ATINGIVEL: "bg-destructive/15 text-destructive border-destructive/30",
  DADOS_INSUFICIENTES: "bg-muted text-muted-foreground border-border",
};

export function GoalStatusBadge({
  status,
  className,
}: {
  status: GoalStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

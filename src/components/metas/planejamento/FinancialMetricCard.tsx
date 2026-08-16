import { cn } from "@/lib/utils";

interface FinancialMetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "danger";
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  /** Altura natural (sem esticar) — usado quando há dois cards empilhados na mesma linha. */
  dense?: boolean;
}

const TONES: Record<NonNullable<FinancialMetricCardProps["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-destructive",
};

export function FinancialMetricCard({
  icon,
  label,
  value,
  tone = "default",
  interactive,
  active,
  onClick,
  rightSlot,
  dense,
}: FinancialMetricCardProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col justify-center gap-1",
        dense ? "px-3.5 py-2" : "px-3.5 py-2.5 h-full",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-bold font-mono truncate",
            dense ? "text-base" : "text-lg",
            TONES[tone],
          )}
        >
          {value}
        </p>
        {rightSlot}
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "glass-card glass-card-interactive w-full text-left",
          !dense && "h-full",
          active && "glass-card-active",
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={cn("glass-card", !dense && "h-full")}>{content}</div>;
}


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
}: FinancialMetricCardProps) {
  const content = (
    <div className="px-3.5 py-2.5 h-full flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={cn("text-base font-bold font-mono truncate", TONES[tone])}>{value}</p>
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
          "glass-card glass-card-interactive w-full h-full text-left",
          active && "glass-card-active",
        )}
      >
        {content}
      </button>
    );
  }

  return <div className="glass-card h-full">{content}</div>;
}


import { cn } from "@/lib/utils";

interface GoalScoreRingProps {
  score: number;
  label?: string;
  caption?: string;
  size?: number;
  className?: string;
}

export function GoalScoreRing({
  score,
  label,
  caption,
  size = 132,
  className,
}: GoalScoreRingProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono text-foreground">{clamped}</span>
          {label && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          )}
        </div>
      </div>
      {caption && <p className="text-xs text-muted-foreground text-center">{caption}</p>}
    </div>
  );
}

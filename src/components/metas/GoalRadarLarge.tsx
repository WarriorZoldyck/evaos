import { LifeBuoy } from "lucide-react";

interface GoalRadarLargeProps {
  progress: number; // 0..100
  isCompleted: boolean;
}

export function GoalRadarLarge({ progress, isCompleted }: GoalRadarLargeProps) {
  const stroke = isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))";
  const CIRC = 2 * Math.PI * 92;

  return (
    <div className="relative h-56 w-56 mx-auto flex items-center justify-center">
      <div className={`
        absolute inset-6 rounded-full flex items-center justify-center
        ${isCompleted ? "bg-success/10" : "bg-primary/10"}
      `}>
        <LifeBuoy
          className={`h-28 w-28 ${isCompleted ? "text-success" : "text-primary"}`}
          strokeWidth={1.5}
        />
      </div>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle
          cx="100" cy="100" r="92"
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeDasharray={`${(progress / 100) * CIRC} ${CIRC}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
    </div>
  );
}

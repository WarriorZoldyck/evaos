import { LifeBuoy } from "lucide-react";

interface GoalRadarLargeProps {
  progress: number; // 0..100
  isCompleted: boolean;
}

export function GoalRadarLarge({ progress, isCompleted }: GoalRadarLargeProps) {
  const stroke = isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))";
  const CIRC = 2 * Math.PI * 88; // r=88

  return (
    <div className="relative h-52 w-52 mx-auto flex items-center justify-center">
      <div className={`
        absolute inset-4 rounded-full flex items-center justify-center
        ${isCompleted ? "bg-success/10" : "bg-primary/10"}
      `}>
        <LifeBuoy className={`h-24 w-24 ${isCompleted ? "text-success" : "text-primary"} opacity-80`} strokeWidth={1.5} />
      </div>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
        <circle
          cx="100" cy="100" r="88"
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeDasharray={`${(progress / 100) * CIRC} ${CIRC}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
    </div>
  );
}

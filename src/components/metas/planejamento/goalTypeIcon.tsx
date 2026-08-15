import { Shield, Sparkles, TrendingUp, CreditCard, Target } from "lucide-react";
import type { GoalType } from "@/lib/allocation";

const ICONS: Record<GoalType, React.ComponentType<{ className?: string }>> = {
  reserva: Shield,
  sonho: Sparkles,
  investimento: TrendingUp,
  divida: CreditCard,
  outro: Target,
};

export function GoalTypeIcon({ type, className }: { type: GoalType; className?: string }) {
  const Icon = ICONS[type] ?? Target;
  return <Icon className={className} />;
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Plus, Sparkles, Plane, Wrench } from "lucide-react";
import { useGoals, type Goal } from "@/hooks/useGoals";
import { useCompany } from "@/contexts/CompanyContext";
import { GoalListItem } from "@/components/metas/GoalListItem";
import { GoalFormModal } from "@/components/metas/GoalFormModal";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SUGGESTIONS = [
  { icon: Sparkles, name: "Reserva de emergência", target: 10000, color: "text-primary", bg: "bg-primary/10" },
  { icon: Plane, name: "Viagem dos sonhos", target: 5000, color: "text-sky-500", bg: "bg-sky-500/10" },
  { icon: Wrench, name: "Troca de equipamento", target: 3000, color: "text-amber-500", bg: "bg-amber-500/10" },
];

export default function Metas() {
  const navigate = useNavigate();
  const { isPersonal } = useCompany();
  const { goals, loading, createGoal, updateGoal } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; target: number } | null>(null);

  const total = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals]);
  const targetTotal = useMemo(() => goals.reduce((s, g) => s + g.target_amount, 0), [goals]);

  const openCreate = (suggestion?: { name: string; target: number }) => {
    setPrefill(suggestion || null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Guarde dinheiro para seus objetivos — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova meta
        </Button>
      </div>

      {/* Saldo consolidado */}
      {!loading && goals.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total guardado</p>
          <p className="text-4xl font-bold font-mono text-foreground mt-1">{formatCurrency(total)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            de {formatCurrency(targetTotal)} em {goals.length} {goals.length === 1 ? "meta" : "metas"}
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <LifeBuoy className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Nenhuma meta criada</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Crie sua primeira meta para começar a guardar dinheiro e atingir seus objetivos.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Opções para começar</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => openCreate({ name: s.name, target: s.target })}
                  className="text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <p className="font-medium text-sm text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Meta sugerida: {formatCurrency(s.target)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground px-1">Seus cofrinhos</h3>
          {goals.map((g) => (
            <GoalListItem key={g.id} goal={g} onClick={(goal) => navigate(`/metas/${goal.id}`)} />
          ))}
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setPrefill(null); }}
        editGoal={prefill ? ({
          id: "", user_id: "", company_id: null,
          name: prefill.name, target_amount: prefill.target,
          current_amount: 0, deadline: null,
          auto_reserve_enabled: false, auto_reserve_frequency: null,
          auto_reserve_per_expense: 0, auto_reserve_per_sale: 0,
          auto_reserve_amount: 0, icon: "", created_at: "",
        } as Goal) : null}
        onSave={createGoal}
        onUpdate={updateGoal}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Plus, Sparkles, Plane, Wrench } from "lucide-react";
import { useGoals, type Goal } from "@/hooks/useGoals";
import { useCompany } from "@/contexts/CompanyContext";
import { GoalListItem } from "@/components/metas/GoalListItem";
import { GoalFormModal } from "@/components/metas/GoalFormModal";
import { MetasSidebar } from "@/components/metas/MetasSidebar";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SUGGESTIONS = [
  { icon: Sparkles, name: "Reserva de emergência", target: 10000 },
  { icon: Plane, name: "Viagem dos sonhos", target: 5000 },
  { icon: Wrench, name: "Troca de equipamento", target: 3000 },
];

export default function Metas() {
  const navigate = useNavigate();
  const { isPersonal } = useCompany();
  const { goals, loading, createGoal, updateGoal } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; target: number } | null>(null);

  const total = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals]);

  const openCreate = (suggestion?: { name: string; target: number }) => {
    setPrefill(suggestion || null);
    setFormOpen(true);
  };

  return (
    <div className="metas-scope animate-fade-in grid gap-12 lg:grid-cols-[380px_minmax(0,720px)] justify-start pl-2">
      <MetasSidebar goals={goals} />
      <div className="space-y-6 min-w-0">
      {/* Header enxuto */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cofrinhos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button
          onClick={() => openCreate()}
          size="icon"
          className="h-11 w-11 rounded-full shrink-0"
          aria-label="Nova meta"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Saldo consolidado */}
      {!loading && goals.length > 0 && (
        <div className="rounded-2xl bg-primary/10 p-6">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Total guardado
          </p>
          <p className="text-4xl font-bold font-mono text-foreground mt-2">
            {formatCurrency(total)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            em {goals.length} {goals.length === 1 ? "cofrinho ativo" : "cofrinhos ativos"}
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="space-y-8">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LifeBuoy className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold mb-1">Nenhum cofrinho ainda</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Crie seu primeiro cofrinho para começar a guardar dinheiro e atingir seus objetivos.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Comece com uma sugestão
            </h3>
            <div className="divide-y divide-border">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => openCreate({ name: s.name, target: s.target })}
                  className="w-full flex items-center gap-4 py-4 px-1 text-left hover:bg-accent/40 transition-colors rounded-lg"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sugestão: {formatCurrency(s.target)}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
            Meus cofrinhos
          </h3>
          <div className="divide-y divide-border">
            {goals.map((g) => (
              <GoalListItem key={g.id} goal={g} onClick={(goal) => navigate(`/metas/${goal.id}`)} />
            ))}
          </div>
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
    </div>
  );
}

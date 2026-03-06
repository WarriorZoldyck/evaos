import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { Goal, GoalMovement } from "@/hooks/useGoals";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface GoalHistoryModalProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  fetchMovements: (goalId: string) => Promise<GoalMovement[]>;
}

export function GoalHistoryModal({ open, onClose, goal, fetchMovements }: GoalHistoryModalProps) {
  const [movements, setMovements] = useState<GoalMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && goal) {
      setLoading(true);
      fetchMovements(goal.id).then((data) => {
        setMovements(data);
        setLoading(false);
      });
    }
  }, [open, goal, fetchMovements]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {goal?.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : movements.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                {m.type === "reserve" ? (
                  <ArrowUpCircle className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.description || (m.type === "reserve" ? "Reserva" : "Retirada")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR")} às {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Badge variant={m.type === "reserve" ? "default" : "destructive"} className="font-mono text-xs">
                  {m.type === "reserve" ? "+" : "-"}{formatCurrency(m.amount)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

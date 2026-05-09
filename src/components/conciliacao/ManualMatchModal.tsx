import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, addDays } from "date-fns";

interface ManualMatchModalProps {
  item: { id: string; amount: number; date: string; description: string };
  bankAccountId: string;
  onClose: () => void;
  onConfirm: (transactionId: string) => Promise<void>;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ManualMatchModal({ item, bankAccountId, onClose, onConfirm }: ManualMatchModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [windowDays, setWindowDays] = useState(7);
  const [exactValue, setExactValue] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      const dFrom = format(subDays(new Date(item.date + "T00:00:00"), windowDays), "yyyy-MM-dd");
      const dTo = format(addDays(new Date(item.date + "T00:00:00"), windowDays), "yyyy-MM-dd");
      let q = supabase
        .from("transactions")
        .select("id, description, amount, payment_date, type, contact_name, is_reconciled")
        .eq("user_id", user.id)
        .eq("bank_account_id", bankAccountId)
        .gte("payment_date", dFrom)
        .lte("payment_date", dTo)
        .order("payment_date", { ascending: false })
        .limit(50);
      if (exactValue) q = q.eq("amount", item.amount);
      if (search.trim()) q = q.ilike("description", `%${search.trim()}%`);
      const { data } = await q;
      setResults(data || []);
      setLoading(false);
    };
    run();
  }, [user, item, bankAccountId, windowDays, exactValue, search]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try { await onConfirm(selected); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Buscar lançamento para conciliar</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Item Asaas</p>
          <div className="flex justify-between items-center mt-1">
            <span className="font-medium truncate">{item.description}</span>
            <span className="font-bold">{fmt(item.amount)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")}</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-48" />
          <select className="rounded-md border bg-background px-2 py-2 text-sm" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            <option value={3}>±3 dias</option>
            <option value={7}>±7 dias</option>
            <option value={15}>±15 dias</option>
            <option value={30}>±30 dias</option>
          </select>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={exactValue} onChange={(e) => setExactValue(e.target.checked)} />
            valor exato
          </label>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-32">
          {loading ? (
            <div className="text-center p-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">Nenhum lançamento encontrado.</p>
          ) : (
            results.map((tx) => (
              <button
                type="button"
                key={tx.id}
                onClick={() => setSelected(tx.id)}
                disabled={tx.is_reconciled}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === tx.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                } ${tx.is_reconciled ? "opacity-50" : ""}`}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.payment_date + "T00:00:00"), "dd/MM/yyyy")} · {tx.type}
                      {tx.contact_name ? ` · ${tx.contact_name}` : ""}
                      {tx.is_reconciled ? " · já conciliado" : ""}
                    </p>
                  </div>
                  <span className="font-bold whitespace-nowrap">{fmt(Number(tx.amount))}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar conciliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

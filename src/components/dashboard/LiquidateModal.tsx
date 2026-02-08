import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  payment_date: string;
  bank_account_id: string | null;
}

interface LiquidateModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface BankAccount {
  id: string;
  name: string;
}

export function LiquidateModal({ transaction, onClose, onSuccess }: LiquidateModalProps) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [finalAmount, setFinalAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction || !user) return;

    setFinalAmount(String(transaction.amount));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setAccountId(transaction.bank_account_id || "");
    setNotes("");

    const fetchAccounts = async () => {
      let query = supabase.from("bank_accounts").select("id, name");

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data } = await query.order("name");
      if (data) setAccounts(data);
    };

    fetchAccounts();
  }, [transaction, user, selectedCompanyId, isPersonal]);

  const handleLiquidate = async () => {
    if (!transaction) return;

    setSaving(true);

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "Pago" as const,
        amount: Number(finalAmount),
        payment_date: paymentDate,
        bank_account_id: accountId || null,
        liquidation_notes: notes || null,
      })
      .eq("id", transaction.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Erro ao liquidar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Lançamento liquidado!",
        description: `"${transaction.description}" marcado como pago.`,
      });
      onSuccess();
    }
  };

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Liquidar Lançamento</DialogTitle>
          <DialogDescription>
            Confirme os dados para marcar como pago.
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{transaction.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {transaction.type === "receita" ? "Receita" : "Despesa"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalAmount">Valor Final (R$)</Label>
              <Input
                id="finalAmount"
                type="number"
                step="0.01"
                value={finalAmount}
                onChange={(e) => setFinalAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data de Pagamento</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Conta de Saída</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre a liquidação..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleLiquidate} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Liquidação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

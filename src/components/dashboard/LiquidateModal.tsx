import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  payment_date: string;
  bank_account_id: string | null;
  series_id: string | null;
  credit_card_id: string | null;
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

  // Series liquidation
  const [seriesScope, setSeriesScope] = useState<"only" | "all">("only");

  // Credit card bill installment
  const [parcelarFatura, setParcelarFatura] = useState(false);
  const [faturaInstallments, setFaturaInstallments] = useState("2");
  const [faturaInterest, setFaturaInterest] = useState("0");

  useEffect(() => {
    if (!transaction || !user) return;

    setFinalAmount(String(transaction.amount));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setAccountId(transaction.bank_account_id || "");
    setNotes("");
    setSeriesScope("only");
    setParcelarFatura(false);
    setFaturaInstallments("2");
    setFaturaInterest("0");

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
    if (!transaction || !user) return;

    setSaving(true);

    try {
      // 1. Liquidate the main transaction (or series)
      if (transaction.series_id && seriesScope === "all") {
        // Liquidate all pending in series
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "Pago" as const,
            payment_date: paymentDate,
            bank_account_id: accountId || null,
            liquidation_notes: notes || null,
          })
          .eq("series_id", transaction.series_id)
          .eq("status", "Pendente");

        if (error) throw error;
      } else {
        // Liquidate only this one
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

        if (error) throw error;
      }

      // 2. Create installment transactions if parcelar fatura
      if (parcelarFatura && transaction.credit_card_id) {
        const parcelas = Number(faturaInstallments);
        const juros = Number(faturaInterest);
        const totalComJuros = Number(finalAmount) * (1 + juros / 100);
        const valorParcela = Math.round((totalComJuros / parcelas) * 100) / 100;
        const seriesId = crypto.randomUUID();

        const installments = [];
        for (let i = 0; i < parcelas; i++) {
          const payDate = addMonths(new Date(paymentDate), i + 1);
          installments.push({
            user_id: user.id,
            company_id: isPersonal ? null : selectedCompanyId,
            type: transaction.type,
            description: `${transaction.description} (Parcela Fatura ${i + 1}/${parcelas})`,
            amount: valorParcela,
            payment_date: format(payDate, "yyyy-MM-dd"),
            competence_date: format(payDate, "yyyy-MM-dd"),
            status: "Pendente" as const,
            category: "Cartão de Crédito",
            bank_account_id: accountId || null,
            credit_card_id: transaction.credit_card_id,
            parent_id: transaction.id,
            series_id: seriesId,
            installment_number: i + 1,
            installments_total: parcelas,
            original_amount: totalComJuros,
            notes: juros > 0 ? `Juros de ${juros}% sobre fatura parcelada` : null,
          });
        }

        const { error: instError } = await supabase.from("transactions").insert(installments);
        if (instError) throw instError;
      }

      toast({
        title: "Lançamento liquidado!",
        description: seriesScope === "all"
          ? `Todos os pendentes da série "${transaction.description}" foram liquidados.`
          : `"${transaction.description}" marcado como pago.${parcelarFatura ? ` ${faturaInstallments} parcelas criadas.` : ""}`,
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao liquidar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalComJuros = parcelarFatura
    ? Number(finalAmount) * (1 + Number(faturaInterest) / 100)
    : 0;
  const valorParcela = parcelarFatura && Number(faturaInstallments) > 0
    ? Math.round((totalComJuros / Number(faturaInstallments)) * 100) / 100
    : 0;

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

            {/* Series liquidation option */}
            {transaction.series_id && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Este lançamento faz parte de uma série</span>
                </div>
                <RadioGroup value={seriesScope} onValueChange={(v) => setSeriesScope(v as "only" | "all")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="only" id="scope-only" />
                    <Label htmlFor="scope-only" className="text-sm">Liquidar somente este</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="scope-all" />
                    <Label htmlFor="scope-all" className="text-sm">Liquidar todos pendentes da série</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="finalAmount">Valor Final (R$)</Label>
              <Input
                id="finalAmount"
                type="number"
                step="0.01"
                value={finalAmount}
                onChange={(e) => setFinalAmount(e.target.value)}
                disabled={seriesScope === "all"}
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

            {/* Credit card bill installment */}
            {transaction.credit_card_id && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="parcelar-fatura"
                    checked={parcelarFatura}
                    onCheckedChange={setParcelarFatura}
                  />
                  <Label htmlFor="parcelar-fatura" className="text-sm font-medium">
                    Parcelar esta fatura
                  </Label>
                </div>

                {parcelarFatura && (
                  <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nº de parcelas</Label>
                        <Input
                          type="number"
                          min="2"
                          max="48"
                          value={faturaInstallments}
                          onChange={(e) => setFaturaInstallments(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa de juros (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={faturaInterest}
                          onChange={(e) => setFaturaInterest(e.target.value)}
                        />
                      </div>
                    </div>

                    {totalComJuros > 0 && (
                      <div className="rounded bg-muted/50 p-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor original</span>
                          <span>{Number(finalAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        {Number(faturaInterest) > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Juros ({faturaInterest}%)</span>
                            <span>+{(totalComJuros - Number(finalAmount)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>Total ({faturaInstallments}x)</span>
                          <span>{totalComJuros.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Valor da parcela</span>
                          <span>{valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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

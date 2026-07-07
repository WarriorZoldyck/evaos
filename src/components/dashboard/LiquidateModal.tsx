import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
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
import { Loader2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  payment_date: string;
  bank_account_id: string | null;
  series_id: string | null;
  credit_card_id: string | null;
  category?: string;
  subcategory?: string | null;
  subcategory2?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
  original_amount?: number | null;
}

interface LiquidateModalProps {
  transaction: Transaction | null;
  bulkTransactionIds?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BankAccount {
  id: string;
  name: string;
}

type DifferenceAction =
  | "discard"
  | "create_pending"
  | "apply_interest"
  | "redistribute";

type ExcessAction =
  | "register_as_is"
  | "create_separate";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LiquidateModal({ transaction, bulkTransactionIds, onClose, onSuccess }: LiquidateModalProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  // Step 1 fields
  const [finalAmount, setFinalAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);

  // Series liquidation scope
  const [seriesScope, setSeriesScope] = useState<"only" | "all">("only");

  // Credit card bill installment
  const [parcelarFatura, setParcelarFatura] = useState(false);
  const [faturaInstallments, setFaturaInstallments] = useState("2");
  const [faturaInterest, setFaturaInterest] = useState("0");

  // Step management
  const [step, setStep] = useState(1);

  // Step 2: difference handling
  const [differenceAction, setDifferenceAction] = useState<DifferenceAction>("discard");
  const [interestRate, setInterestRate] = useState("0");
  const [excessAction, setExcessAction] = useState<ExcessAction>("register_as_is");
  const [excessDescription, setExcessDescription] = useState("");

  // Series info for redistribution preview
  const [pendingInstallmentsCount, setPendingInstallmentsCount] = useState(0);
  const [pendingInstallments, setPendingInstallments] = useState<Array<{ id: string; installment_number: number | null; amount: number; payment_date: string }>>([]);

  const isBulk = bulkTransactionIds && bulkTransactionIds.length > 1;

  useEffect(() => {
    if (!transaction || !user || !effectiveUserId) return;

    setFinalAmount(String(transaction.amount));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setAccountId(transaction.bank_account_id || "");
    setNotes("");
    setSeriesScope("only");
    setParcelarFatura(false);
    setFaturaInstallments("2");
    setFaturaInterest("0");
    setStep(1);
    setDifferenceAction("discard");
    setInterestRate("0");
    setExcessAction("register_as_is");
    setExcessDescription("");
    setPendingInstallmentsCount(0);
    setPendingInstallments([]);
    const fetchAccounts = async () => {
      let query = supabase.from("bank_accounts").select("id, name").eq("user_id", effectiveUserId);
      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }
      const { data } = await query.order("name");
      if (data) setAccounts(data);
    };

    fetchAccounts();

    // If part of a series, fetch pending installments with details
    if (transaction.series_id) {
      supabase
        .from("transactions")
        .select("id, installment_number, amount, payment_date")
        .eq("user_id", effectiveUserId)
        .eq("series_id", transaction.series_id)
        .eq("status", "Pendente")
        .neq("id", transaction.id)
        .order("installment_number", { ascending: true })
        .then(({ data, count }) => {
          setPendingInstallmentsCount(data?.length || 0);
          setPendingInstallments(data || []);
        });
    }
  }, [transaction, user, effectiveUserId, selectedCompanyId, isPersonal]);

  const originalAmount = transaction?.amount || 0;
  const finalAmountNum = Number(finalAmount) || 0;
  const difference = Math.round((originalAmount - finalAmountNum) * 100) / 100;
  const hasDifference = seriesScope === "only" && !isBulk && Math.abs(difference) >= 0.01;
  const isUnderpayment = difference > 0;
  const isOverpayment = difference < 0;
  const absDifference = Math.abs(difference);

  const hasSeries = !!transaction?.series_id && pendingInstallmentsCount > 0;

  // Interest calculation for underpayment
  const interestRateNum = Number(interestRate) || 0;
  const interestAmount = Math.round(absDifference * (interestRateNum / 100) * 100) / 100;
  const totalWithInterest = Math.round((absDifference + interestAmount) * 100) / 100;

  // Redistribution preview
  const newAmountPerInstallment = hasSeries && pendingInstallmentsCount > 0
    ? Math.round(((originalAmount * pendingInstallmentsCount + difference) / pendingInstallmentsCount) * 100) / 100
    : 0;

  const handleNext = () => {
    if (hasDifference) {
      setStep(2);
    } else {
      handleLiquidate();
    }
  };

  const handleLiquidate = async () => {
    if (!transaction || !user) return;

    setSaving(true);

    try {
      if (isBulk) {
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "Pago" as const,
            payment_date: paymentDate,
            bank_account_id: accountId || null,
            liquidation_notes: notes || null,
          })
          .in("id", bulkTransactionIds!);
        if (error) throw error;
      } else if (transaction.series_id && seriesScope === "all") {
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
        // Liquidate this single transaction
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "Pago" as const,
            amount: finalAmountNum,
            payment_date: paymentDate,
            bank_account_id: accountId || null,
            liquidation_notes: notes || null,
          })
          .eq("id", transaction.id);
        if (error) throw error;

        // Handle difference actions
        if (hasDifference && isUnderpayment) {
          await handleUnderpaymentAction(transaction);
        } else if (hasDifference && isOverpayment) {
          await handleOverpaymentAction(transaction);
        }
      }

      // Create installment transactions if parcelar fatura
      if (parcelarFatura && transaction.credit_card_id && !isBulk) {
        const parcelas = Number(faturaInstallments);
        const juros = Number(faturaInterest);
        const totalComJuros = finalAmountNum * (1 + juros / 100);
        const valorParcela = Math.round((totalComJuros / parcelas) * 100) / 100;
        const seriesId = crypto.randomUUID();

        const installments = [];
        for (let i = 0; i < parcelas; i++) {
          const payDate = addMonths(new Date(paymentDate), i + 1);
          installments.push({
            user_id: effectiveUserId,
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
        title: isBulk ? "Fatura liquidada!" : "Lançamento liquidado!",
        description: buildSuccessDescription(transaction),
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

  const handleUnderpaymentAction = async (t: Transaction) => {
    if (!user) return;

    switch (differenceAction) {
      case "discard":
        // Nothing extra to do
        break;

      case "create_pending": {
        const { error } = await supabase.from("transactions").insert({
          user_id: effectiveUserId,
          company_id: isPersonal ? null : selectedCompanyId,
          type: t.type,
          description: `${t.description} (Saldo restante)`,
          amount: absDifference,
          payment_date: t.payment_date,
          competence_date: t.payment_date,
          status: "Pendente" as const,
          category: t.category || "Outros",
          subcategory: t.subcategory || null,
          subcategory2: t.subcategory2 || null,
          bank_account_id: accountId || null,
        });
        if (error) throw error;
        break;
      }

      case "apply_interest": {
        const { error } = await supabase.from("transactions").insert({
          user_id: effectiveUserId,
          company_id: isPersonal ? null : selectedCompanyId,
          type: t.type,
          description: `${t.description} (Saldo + juros ${interestRate}%)`,
          amount: totalWithInterest,
          payment_date: t.payment_date,
          competence_date: t.payment_date,
          status: "Pendente" as const,
          category: t.category || "Outros",
          subcategory: t.subcategory || null,
          subcategory2: t.subcategory2 || null,
          bank_account_id: accountId || null,
        });
        if (error) throw error;
        break;
      }

      case "redistribute": {
        if (!t.series_id) break;
        // Calculate what the remaining installments should total
        // The difference is the amount NOT paid on this installment
        // Add it evenly to the pending ones
        const { data: pending } = await supabase
          .from("transactions")
          .select("id, amount")
          .eq("series_id", t.series_id)
          .eq("status", "Pendente")
          .neq("id", t.id)
          .order("installment_number", { ascending: true });

        if (pending && pending.length > 0) {
          const currentTotal = pending.reduce((sum, p) => sum + p.amount, 0);
          const newTotal = currentTotal + absDifference;
          const perInstallment = Math.round((newTotal / pending.length) * 100) / 100;

          const ids = pending.map((p) => p.id);
          const { error } = await supabase
            .from("transactions")
            .update({ amount: perInstallment })
            .in("id", ids);
          if (error) throw error;
        }
        break;
      }
    }
  };

  const handleOverpaymentAction = async (t: Transaction) => {
    if (!user) return;

    if (excessAction === "create_separate") {
      const { error } = await supabase.from("transactions").insert({
        user_id: effectiveUserId,
        company_id: isPersonal ? null : selectedCompanyId,
        type: t.type,
        description: excessDescription || `${t.description} (Excedente)`,
        amount: absDifference,
        payment_date: paymentDate,
        competence_date: paymentDate,
        status: "Pago" as const,
        category: t.category || "Outros",
        bank_account_id: accountId || null,
      });
      if (error) throw error;
    }
    // "register_as_is" — nothing extra
  };

  const buildSuccessDescription = (t: Transaction) => {
    if (isBulk) return `${bulkTransactionIds!.length} lançamentos da fatura marcados como pagos.`;
    if (seriesScope === "all") return `Todos os pendentes da série "${t.description}" foram liquidados.`;

    let msg = `"${t.description}" marcado como pago.`;
    if (parcelarFatura) msg += ` ${faturaInstallments} parcelas criadas.`;
    if (hasDifference && isUnderpayment) {
      if (differenceAction === "create_pending") msg += ` Lançamento pendente de ${formatCurrency(absDifference)} criado.`;
      if (differenceAction === "apply_interest") msg += ` Lançamento com juros de ${formatCurrency(totalWithInterest)} criado.`;
      if (differenceAction === "redistribute") msg += ` Saldo redistribuído entre ${pendingInstallmentsCount} parcelas.`;
    }
    if (hasDifference && isOverpayment && excessAction === "create_separate") {
      msg += ` Excedente de ${formatCurrency(absDifference)} registrado separadamente.`;
    }
    return msg;
  };

  const totalComJuros = parcelarFatura
    ? finalAmountNum * (1 + Number(faturaInterest) / 100)
    : 0;
  const valorParcela = parcelarFatura && Number(faturaInstallments) > 0
    ? Math.round((totalComJuros / Number(faturaInstallments)) * 100) / 100
    : 0;

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isBulk ? "Liquidar Fatura" : "Liquidar Lançamento"}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Confirme os dados para marcar como pago."
              : isUnderpayment
                ? "O valor é menor que o previsto. O que fazer com a diferença?"
                : "O valor é maior que o previsto. Como registrar o excedente?"}
          </DialogDescription>
        </DialogHeader>

        {transaction && step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{transaction.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isBulk
                  ? `${bulkTransactionIds!.length} lançamentos • Total: ${formatCurrency(transaction.amount)}`
                  : transaction.type === "receita" ? "Receita" : "Despesa"}
              </p>
            </div>

            {/* Series liquidation option */}
            {transaction.series_id && !isBulk && (
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

            {!isBulk && (
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
                {hasDifference && (
                  <p className={`text-xs ${isUnderpayment ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
                    {isUnderpayment
                      ? `Pagamento parcial: ${formatCurrency(absDifference)} a menos`
                      : `Pagamento excedente: ${formatCurrency(absDifference)} a mais`}
                  </p>
                )}
              </div>
            )}

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
              <Label htmlFor="account">Conta</Label>
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
            {transaction.credit_card_id && !isBulk && (
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
                          <span>{formatCurrency(finalAmountNum)}</span>
                        </div>
                        {Number(faturaInterest) > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Juros ({faturaInterest}%)</span>
                            <span>+{formatCurrency(totalComJuros - finalAmountNum)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>Total ({faturaInstallments}x)</span>
                          <span>{formatCurrency(totalComJuros)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Valor da parcela</span>
                          <span>{formatCurrency(valorParcela)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Difference handling */}
        {transaction && step === 2 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor original</span>
                <span className="font-medium">{formatCurrency(originalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor pago</span>
                <span className="font-medium">{formatCurrency(finalAmountNum)}</span>
              </div>
              <Separator />
              <div className={`flex justify-between text-sm font-semibold ${isUnderpayment ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
                <span>{isUnderpayment ? "Saldo restante" : "Excedente"}</span>
                <span>{formatCurrency(absDifference)}</span>
              </div>
            </div>

            {isUnderpayment && (
              <RadioGroup value={differenceAction} onValueChange={(v) => setDifferenceAction(v as DifferenceAction)}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="discard" id="diff-discard" className="mt-0.5" />
                    <div>
                      <Label htmlFor="diff-discard" className="text-sm font-medium">Descartar a diferença</Label>
                      <p className="text-xs text-muted-foreground">Registrar apenas {formatCurrency(finalAmountNum)}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="create_pending" id="diff-pending" className="mt-0.5" />
                    <div>
                      <Label htmlFor="diff-pending" className="text-sm font-medium">Criar lançamento pendente</Label>
                      <p className="text-xs text-muted-foreground">Novo lançamento de {formatCurrency(absDifference)} pendente na mesma categoria</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="apply_interest" id="diff-interest" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="diff-interest" className="text-sm font-medium">Aplicar juros/multa sobre o saldo</Label>
                      <p className="text-xs text-muted-foreground mb-2">Criar lançamento pendente com juros</p>
                      {differenceAction === "apply_interest" && (
                        <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Taxa (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={interestRate}
                              onChange={(e) => setInterestRate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="rounded bg-muted/50 p-2 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Saldo</span>
                              <span>{formatCurrency(absDifference)}</span>
                            </div>
                            {interestRateNum > 0 && (
                              <div className="flex justify-between text-destructive">
                                <span>Juros ({interestRate}%)</span>
                                <span>+{formatCurrency(interestAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold border-t pt-1">
                              <span>Total pendente</span>
                              <span>{formatCurrency(totalWithInterest)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasSeries && (
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="redistribute" id="diff-redistribute" className="mt-0.5" />
                      <div>
                        <Label htmlFor="diff-redistribute" className="text-sm font-medium">Redistribuir entre parcelas restantes</Label>
                        <p className="text-xs text-muted-foreground">
                          Dividir {formatCurrency(absDifference)} entre {pendingInstallmentsCount} parcela{pendingInstallmentsCount > 1 ? "s" : ""} pendente{pendingInstallmentsCount > 1 ? "s" : ""}
                        </p>
                        {differenceAction === "redistribute" && (
                          <div className="rounded bg-muted/50 p-2 mt-2 text-xs space-y-2">
                            <p className="text-muted-foreground">
                              Cada parcela receberá +{formatCurrency(Math.round((absDifference / pendingInstallmentsCount) * 100) / 100)} adicional
                            </p>
                            {pendingInstallments.length > 0 && (
                              <div className="border rounded border-border overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left px-2 py-1 font-medium text-muted-foreground">Parcela</th>
                                      <th className="text-right px-2 py-1 font-medium text-muted-foreground">Atual</th>
                                      <th className="text-right px-2 py-1 font-medium text-muted-foreground">Novo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pendingInstallments.map((inst) => {
                                      const currentTotal = pendingInstallments.reduce((s, p) => s + p.amount, 0);
                                      const newTotal = currentTotal + absDifference;
                                      const newAmount = Math.round((newTotal / pendingInstallments.length) * 100) / 100;
                                      return (
                                        <tr key={inst.id} className="border-t border-border">
                                          <td className="px-2 py-1">
                                            {inst.installment_number ? `#${inst.installment_number}` : format(new Date(inst.payment_date + "T00:00:00"), "dd/MM")}
                                          </td>
                                          <td className="text-right px-2 py-1 text-muted-foreground">{formatCurrency(inst.amount)}</td>
                                          <td className="text-right px-2 py-1 font-medium">{formatCurrency(newAmount)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </RadioGroup>
            )}

            {isOverpayment && (
              <RadioGroup value={excessAction} onValueChange={(v) => setExcessAction(v as ExcessAction)}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="register_as_is" id="excess-as-is" className="mt-0.5" />
                    <div>
                      <Label htmlFor="excess-as-is" className="text-sm font-medium">Registrar apenas o valor pago</Label>
                      <p className="text-xs text-muted-foreground">Salvar {formatCurrency(finalAmountNum)} sem ação extra</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="create_separate" id="excess-separate" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="excess-separate" className="text-sm font-medium">Criar lançamento separado para o excedente</Label>
                      <p className="text-xs text-muted-foreground mb-2">Ex: juros, multa, acréscimo</p>
                      {excessAction === "create_separate" && (
                        <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                          <div className="space-y-1">
                            <Label className="text-xs">Descrição do excedente</Label>
                            <Input
                              value={excessDescription}
                              onChange={(e) => setExcessDescription(e.target.value)}
                              placeholder="Ex: Juros por atraso"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="rounded bg-muted/50 p-2 text-xs">
                            <div className="flex justify-between font-semibold">
                              <span>Valor do lançamento separado</span>
                              <span>{formatCurrency(absDifference)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} disabled={saving} className="gap-1.5 mr-auto">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {step === 1 ? (
            <Button onClick={handleNext} disabled={saving} className="gap-1.5">
              {hasDifference ? (
                <>Próximo <ArrowRight className="h-3.5 w-3.5" /></>
              ) : (
                <>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Liquidação
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleLiquidate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Liquidação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;

interface CreditCardInfo {
  id: string;
  name: string;
  last_four_digits: string | null;
  closing_day: number;
  due_day: number;
  bank_account_id: string;
  limit: number;
}

interface BankAccount {
  id: string;
  name: string;
}

interface CreditCardBillPaymentModalProps {
  open: boolean;
  creditCard: CreditCardInfo | null;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, opens the modal already positioned on that bill cycle instead of auto-picking the earliest pending. */
  initialReferenceDate?: Date | null;
}

type PaymentType = "full" | "partial" | "extra";
type PartialAction = "roll_next" | "roll_interest" | "create_standalone";
type ExtraAction = "credit_next" | "just_register";
type Step = "review" | "payment" | "difference";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// A fatura é identificada pelo MÊS DE VENCIMENTO (payment_date), não pela
// data de competência. Assim, cada parcela aparece somente na sua própria
// fatura — alinhado com o agrupamento da tela de Lançamentos.
function getBillingCycleDates(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const cycleStart = new Date(year, month, 1);
  const cycleEnd = new Date(year, month + 1, 0); // last day of month
  return { cycleStart, cycleEnd };
}

function getDueDate(closingDay: number, dueDay: number, referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const dd = dueDay && dueDay > 0 ? dueDay : (closingDay || 28);
  return new Date(year, month, dd);
}

export function CreditCardBillPaymentModal({
  open,
  creditCard,
  onClose,
  onSuccess,
  initialReferenceDate,
}: CreditCardBillPaymentModalProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("review");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [billTransactions, setBillTransactions] = useState<Transaction[]>([]);
  const [loadingBill, setLoadingBill] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  // Payment fields
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Difference handling
  const [partialAction, setPartialAction] = useState<PartialAction>("roll_next");
  const [extraAction, setExtraAction] = useState<ExtraAction>("credit_next");
  const [interestRate, setInterestRate] = useState("14");

  const billTotal = useMemo(
    () => billTransactions.reduce((sum, t) => sum + (t.type === "receita" ? -t.amount : t.amount), 0),
    [billTransactions]
  );

  const pendingTotal = useMemo(
    () =>
      billTransactions
        .filter((t) => t.status === "Pendente")
        .reduce((sum, t) => sum + (t.type === "receita" ? -t.amount : t.amount), 0),
    [billTransactions]
  );

  const paymentValue = Number(paymentAmount) || 0;
  const difference = paymentValue - pendingTotal;
  const paymentType: PaymentType =
    Math.abs(difference) < 0.01 ? "full" : difference < 0 ? "partial" : "extra";

  const billingCycle = useMemo(() => {
    if (!creditCard) return null;
    return getBillingCycleDates(referenceDate);
  }, [creditCard, referenceDate]);

  const dueDate = useMemo(() => {
    if (!creditCard) return null;
    return getDueDate(creditCard.closing_day, creditCard.due_day, referenceDate);
  }, [creditCard, referenceDate]);

  // When opening: if caller provided an explicit reference date (e.g. user clicked
  // Pagar Fatura on a specific cycle in Lançamentos), honor it. Otherwise jump to
  // the month of the earliest pending payment for this card.
  useEffect(() => {
    if (!open || !creditCard || !user) return;

    if (initialReferenceDate) {
      setReferenceDate(initialReferenceDate);
      return;
    }

    const pickInitialMonth = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("payment_date")
        .eq("credit_card_id", creditCard.id)
        .eq("status", "Pendente")
        .order("payment_date", { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        const earliest = new Date(data[0].payment_date + "T12:00:00");
        setReferenceDate(new Date(earliest.getFullYear(), earliest.getMonth(), 1));
      } else {
        setReferenceDate(new Date());
      }
    };

    pickInitialMonth();
  }, [open, creditCard, user, initialReferenceDate]);

  // Fetch bill transactions for the selected month. We filter by payment_date so
  // each fatura contains only the installments due in that month — matching the
  // grouping shown on the Lançamentos page.
  useEffect(() => {
    if (!open || !creditCard || !user || !billingCycle) return;

    const fetchBill = async () => {
      setLoadingBill(true);

      const startDate = format(billingCycle.cycleStart, "yyyy-MM-dd");
      const endDate = format(billingCycle.cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("credit_card_id", creditCard.id)
        // Blindagem: a fatura só contém compras feitas no crédito.
        // Lançamentos com método "Cartão de Débito" (legado/erro de cadastro)
        // não devem entrar no total da fatura.
        .or("payment_method.is.null,payment_method.neq.Cartão de Débito")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: true });

      if (error) {
        toast({
          title: "Erro ao carregar fatura",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setBillTransactions(data || []);
      }
      setLoadingBill(false);
    };

    fetchBill();
  }, [open, creditCard, user, billingCycle, toast]);

  // Fetch accounts
  useEffect(() => {
    if (!open || !user) return;

    const fetchAccounts = async () => {
      let query = supabase.from("bank_accounts").select("id, name");
      if (isPersonal) query = query.is("company_id", null);
      else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query.order("name");
      if (data) setAccounts(data);
    };

    fetchAccounts();
  }, [open, user, selectedCompanyId, isPersonal]);

  // Reset state when opening
  useEffect(() => {
    if (open && creditCard) {
      setStep("review");
      setPaymentAmount("");
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setAccountId(creditCard.bank_account_id || "");
      setNotes("");
      setPartialAction("roll_next");
      setExtraAction("credit_next");
      setInterestRate("14");
    }
  }, [open, creditCard]);

  // Sync default payment amount to the pending total whenever the bill changes
  useEffect(() => {
    if (pendingTotal > 0) {
      setPaymentAmount(String(Math.round(pendingTotal * 100) / 100));
    } else {
      setPaymentAmount("");
    }
  }, [pendingTotal]);


  const navigateMonth = (delta: number) => {
    setReferenceDate((prev) => addMonths(prev, delta));
  };

  const handleProceedToPayment = () => {
    setStep("payment");
  };

  const handleProceedToDifference = () => {
    if (paymentType === "full") {
      handleConfirmPayment();
    } else {
      setStep("difference");
    }
  };

  const handleConfirmPayment = async () => {
    if (!creditCard || !user) return;
    setSaving(true);

    try {
      const pendingTransactions = billTransactions.filter((t) => t.status === "Pendente");
      const pendingIds = pendingTransactions.map((t) => t.id);

      // 1. Mark all bill transactions as paid
      if (pendingIds.length > 0) {
        const { error } = await supabase
          .from("transactions")
          .update({
            status: "Pago" as const,
            payment_date: paymentDate,
            bank_account_id: accountId || null,
            liquidation_notes: notes || null,
          })
          .in("id", pendingIds);

        if (error) throw error;
      }

      // 2. Handle difference
      if (paymentType === "partial") {
        const remainder = Math.abs(difference);

        if (partialAction === "roll_next") {
          // Create a pending transaction on the next billing cycle
          const nextDueDate = addMonths(dueDate!, 1);
          await supabase.from("transactions").insert({
            user_id: effectiveUserId,
            company_id: isPersonal ? null : selectedCompanyId,
            type: "despesa" as const,
            description: `Saldo anterior fatura ${creditCard.name}`,
            amount: remainder,
            payment_date: format(nextDueDate, "yyyy-MM-dd"),
            competence_date: format(addMonths(billingCycle!.cycleEnd, 1), "yyyy-MM-dd"),
            status: "Pendente" as const,
            category: "Cartão de Crédito",
            credit_card_id: creditCard.id,
            notes: `Saldo restante da fatura de ${format(referenceDate, "MMMM/yyyy", { locale: ptBR })}`,
          });
        } else if (partialAction === "roll_interest") {
          // Roll with interest
          const rate = Number(interestRate) / 100;
          const amountWithInterest = Math.round(remainder * (1 + rate) * 100) / 100;
          const nextDueDate = addMonths(dueDate!, 1);

          await supabase.from("transactions").insert({
            user_id: effectiveUserId,
            company_id: isPersonal ? null : selectedCompanyId,
            type: "despesa" as const,
            description: `Saldo anterior + juros fatura ${creditCard.name}`,
            amount: amountWithInterest,
            original_amount: remainder,
            payment_date: format(nextDueDate, "yyyy-MM-dd"),
            competence_date: format(addMonths(billingCycle!.cycleEnd, 1), "yyyy-MM-dd"),
            status: "Pendente" as const,
            category: "Cartão de Crédito",
            credit_card_id: creditCard.id,
            notes: `Saldo de ${formatCurrency(remainder)} + juros de ${interestRate}% da fatura de ${format(referenceDate, "MMMM/yyyy", { locale: ptBR })}`,
          });
        } else if (partialAction === "create_standalone") {
          // Create standalone pending transaction
          await supabase.from("transactions").insert({
            user_id: effectiveUserId,
            company_id: isPersonal ? null : selectedCompanyId,
            type: "despesa" as const,
            description: `Saldo não pago fatura ${creditCard.name}`,
            amount: remainder,
            payment_date: paymentDate,
            competence_date: paymentDate,
            status: "Pendente" as const,
            category: "Cartão de Crédito",
            credit_card_id: creditCard.id,
            notes: `Valor não pago da fatura de ${format(referenceDate, "MMMM/yyyy", { locale: ptBR })}`,
          });
        }
      } else if (paymentType === "extra") {
        const credit = difference;

        if (extraAction === "credit_next") {
          // Create a credit (receita) on the next billing cycle
          const nextDueDate = addMonths(dueDate!, 1);
          await supabase.from("transactions").insert({
            user_id: effectiveUserId,
            company_id: isPersonal ? null : selectedCompanyId,
            type: "receita" as const,
            description: `Crédito excedente fatura ${creditCard.name}`,
            amount: credit,
            payment_date: format(nextDueDate, "yyyy-MM-dd"),
            competence_date: format(addMonths(billingCycle!.cycleEnd, 1), "yyyy-MM-dd"),
            status: "Pendente" as const,
            category: "Cartão de Crédito",
            credit_card_id: creditCard.id,
            notes: `Crédito por pagamento excedente da fatura de ${format(referenceDate, "MMMM/yyyy", { locale: ptBR })}`,
          });
        }
        // "just_register" — no extra action needed
      }

      toast({
        title: "Fatura paga!",
        description:
          paymentType === "full"
            ? `Fatura de ${format(referenceDate, "MMMM/yyyy", { locale: ptBR })} liquidada integralmente.`
            : paymentType === "partial"
            ? `Pago ${formatCurrency(paymentValue)} de ${formatCurrency(billTotal)}. ${
                partialAction === "roll_next"
                  ? "Saldo rolado para próxima fatura."
                  : partialAction === "roll_interest"
                  ? "Saldo com juros rolado para próxima fatura."
                  : "Lançamento avulso criado com o saldo."
              }`
            : `Pago ${formatCurrency(paymentValue)}. ${
                extraAction === "credit_next"
                  ? "Crédito excedente adicionado à próxima fatura."
                  : "Pagamento registrado."
              }`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao pagar fatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!creditCard) return null;

  const pendingCount = billTransactions.filter((t) => t.status === "Pendente").length;
  const paidCount = billTransactions.filter((t) => t.status === "Pago").length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <div className="flex flex-col gap-3 p-6 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pagar Fatura
            </DialogTitle>
            <DialogDescription>
              {creditCard.name}
              {creditCard.last_four_digits && ` •••• ${creditCard.last_four_digits}`}
            </DialogDescription>
          </DialogHeader>

          {/* Month Navigator (fixo no topo) */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold capitalize">
                {format(referenceDate, "MMMM yyyy", { locale: ptBR })}
              </p>
              {dueDate && (
                <p className="text-xs text-muted-foreground">
                  Vencimento: {format(dueDate, "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">


        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-4">
            {loadingBill ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : billTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <CreditCard className="h-8 w-8 opacity-50" />
                Nenhuma transação nesta fatura
              </div>
            ) : (
              <>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {billTransactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {t.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(t as any).purchase_date_original && (t as any).purchase_date_original !== t.competence_date
                            ? `Compra: ${format(new Date((t as any).purchase_date_original + "T12:00:00"), "dd/MM/yyyy")} • `
                            : ""}
                          {format(new Date(t.competence_date + "T12:00:00"), "dd/MM")}
                          {t.installment_number && t.installments_total
                            ? ` • ${t.installment_number}/${t.installments_total}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={t.status === "Pago" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                        <span
                          className={`font-mono text-sm ${
                            t.type === "receita"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {t.type === "receita" ? "+" : "-"}
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Total da Fatura</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                      {paidCount > 0 && `, ${paidCount} pago${paidCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <span className="text-lg font-bold font-mono text-foreground">
                    {formatCurrency(billTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Saldo Pendente</span>
              <span className="font-mono font-semibold">{formatCurrency(pendingTotal)}</span>
            </div>


            <div className="space-y-2">
              <Label>Valor do Pagamento (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              {paymentType !== "full" && paymentValue > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  {paymentType === "partial" ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pagamento parcial: faltam {formatCurrency(Math.abs(difference))}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                      Pagamento excedente: +{formatCurrency(difference)}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data de Pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Conta de Saída</Label>
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
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre o pagamento..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step: Difference */}
        {step === "difference" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total da Fatura</span>
                <span className="font-mono">{formatCurrency(billTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Pago</span>
                <span className="font-mono">{formatCurrency(paymentValue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>{paymentType === "partial" ? "Saldo Restante" : "Crédito Excedente"}</span>
                <span
                  className={`font-mono ${
                    paymentType === "partial"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatCurrency(Math.abs(difference))}
                </span>
              </div>
            </div>

            {paymentType === "partial" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  O que fazer com os {formatCurrency(Math.abs(difference))} restantes?
                </Label>
                <RadioGroup
                  value={partialAction}
                  onValueChange={(v) => setPartialAction(v as PartialAction)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="roll_next" id="roll_next" className="mt-0.5" />
                    <div>
                      <Label htmlFor="roll_next" className="text-sm font-medium cursor-pointer">
                        Rolar para a próxima fatura
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        O saldo será adicionado à fatura do próximo mês, sem juros.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="roll_interest" id="roll_interest" className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor="roll_interest"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Rolar com juros (rotativo)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        O saldo será adicionado à próxima fatura com juros.
                      </p>
                      {partialAction === "roll_interest" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Label className="text-xs shrink-0">Taxa de juros (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            className="w-24 h-8 text-sm"
                          />
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs font-mono font-semibold text-destructive">
                            {formatCurrency(
                              Math.round(
                                Math.abs(difference) * (1 + Number(interestRate) / 100) * 100
                              ) / 100
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem
                      value="create_standalone"
                      id="create_standalone"
                      className="mt-0.5"
                    />
                    <div>
                      <Label
                        htmlFor="create_standalone"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Criar lançamento avulso
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Um novo lançamento pendente será criado com o valor restante.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            {paymentType === "extra" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  O que fazer com o crédito de {formatCurrency(difference)}?
                </Label>
                <RadioGroup
                  value={extraAction}
                  onValueChange={(v) => setExtraAction(v as ExtraAction)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="credit_next" id="credit_next" className="mt-0.5" />
                    <div>
                      <Label htmlFor="credit_next" className="text-sm font-medium cursor-pointer">
                        Crédito na próxima fatura
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        O valor excedente aparecerá como crédito na fatura seguinte.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem
                      value="just_register"
                      id="just_register"
                      className="mt-0.5"
                    />
                    <div>
                      <Label
                        htmlFor="just_register"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Apenas registrar o pagamento
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        O valor total pago será registrado, sem criar crédito automático.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border p-4">

          {step === "review" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button
                onClick={handleProceedToPayment}
                disabled={billTransactions.length === 0 || pendingCount === 0}
              >
                Pagar Fatura
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          {step === "payment" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")}>
                Voltar
              </Button>
              <Button onClick={handleProceedToDifference} disabled={paymentValue <= 0}>
                {paymentType === "full" ? "Confirmar Pagamento" : "Continuar"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          {step === "difference" && (
            <>
              <Button variant="outline" onClick={() => setStep("payment")} disabled={saving}>
                Voltar
              </Button>
              <Button onClick={handleConfirmPayment} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Pagamento
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

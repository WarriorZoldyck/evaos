import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MdrInfoCard } from "./MdrInfoCard";
import type { CardTerminalInfo, CreditCard } from "@/hooks/useTransactions";
import { getCreditCardDueDate } from "@/lib/creditCardDueDate";

interface PaymentMethodFieldsProps {
  form: UseFormReturn<any>;
  activeTab: "receita" | "despesa";
  paymentMethod: string | undefined;
  bankAccounts: { id: string; name: string }[];
  creditCards: CreditCard[];
  wallets: { id: string; name: string }[];
  cardTerminals: CardTerminalInfo[];
}

export function PaymentMethodFields({
  form,
  activeTab,
  paymentMethod,
  bankAccounts,
  creditCards,
  wallets,
  cardTerminals,
}: PaymentMethodFieldsProps) {
  const isReceita = activeTab === "receita";
  const isCard = paymentMethod === "Cartão de Crédito" || paymentMethod === "Cartão de Débito";

  // Determine what to show
  const showTerminal = isReceita && isCard;
  const showCreditCardSelect = !isReceita && paymentMethod === "Cartão de Crédito";
  const showBankAccount =
    (!isCard && ["PIX", "Boleto", "Transferência", "Cheque", "Depósito", "Débito Automático"].includes(paymentMethod || "")) ||
    (!isReceita && paymentMethod === "Cartão de Débito");
  const showWallet = paymentMethod === "Dinheiro";

  // Watch terminal selection for MDR
  const selectedTerminalId = form.watch("card_terminal_id");
  const selectedTerminal = cardTerminals.find((t) => t.id === selectedTerminalId);
  const amount = form.watch("amount");
  const competenceDate = form.watch("competence_date");
  const installmentsCount = form.watch("installments_count");
  const isInstallment = form.watch("is_installment");

  // Auto-fill bank_account_id from terminal
  useEffect(() => {
    if (showTerminal && selectedTerminal) {
      form.setValue("bank_account_id", selectedTerminal.bank_account_id);
    }
  }, [showTerminal, selectedTerminal, form]);

  // Auto-set payment_date when credit card selected (despesa only)
  const selectedCreditCardId = form.watch("credit_card_id");
  const selectedCreditCard = creditCards.find((c) => c.id === selectedCreditCardId);

  useEffect(() => {
    if (!showCreditCardSelect || !selectedCreditCard) return;

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const dueISO = getCreditCardDueDate(
      todayISO,
      selectedCreditCard.closing_day,
      selectedCreditCard.due_day,
    );
    form.setValue("payment_date", new Date(dueISO + "T12:00:00"));
  }, [selectedCreditCardId, showCreditCardSelect, selectedCreditCard, form]);

  // Clear irrelevant fields when payment method changes
  useEffect(() => {
    if (!showTerminal) {
      form.setValue("card_terminal_id", "");
    }
    if (!showCreditCardSelect && !showTerminal) {
      // Em despesa, credit_card_id só pertence ao método "Cartão de Crédito".
      // Em receita, o vínculo de cartão vem do terminal — limpamos quando não houver terminal.
      // Isso evita que lançamentos de Débito (ou outros métodos) caiam na fatura do crédito.
      form.setValue("credit_card_id", "");
    }
    if (!showBankAccount && !showTerminal) {
      // Don't clear bank_account_id if terminal is setting it
      if (!showTerminal) form.setValue("bank_account_id", "");
    }
    if (!showWallet) {
      form.setValue("wallet_id", "");
    }
  }, [paymentMethod, activeTab]);

  if (!paymentMethod) return null;

  return (
    <div className="space-y-4">
      {/* Terminal select (receita + card) */}
      {showTerminal && (
        <>
          <FormField
            control={form.control}
            name="card_terminal_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maquininha</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a maquininha" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cardTerminals.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.acquirer ? ` (${t.acquirer})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* MDR info block */}
          {selectedTerminal && amount > 0 && competenceDate && (
            <MdrInfoCard
              terminal={selectedTerminal}
              amount={amount}
              paymentMethod={paymentMethod}
              installmentsCount={isInstallment ? Number(installmentsCount) : undefined}
              paymentDate={competenceDate instanceof Date ? competenceDate : new Date(competenceDate)}
            />
          )}
        </>
      )}

      {/* Credit card select (despesa + cartão de crédito) */}
      {showCreditCardSelect && (
        <FormField
          control={form.control}
          name="credit_card_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cartão de Crédito</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cartão" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {creditCards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.last_four_digits ? ` •••• ${c.last_four_digits}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCreditCard && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fechamento dia {selectedCreditCard.closing_day} • Vencimento dia {selectedCreditCard.due_day}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Bank account */}
      {showBankAccount && (
        <FormField
          control={form.control}
          name="bank_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta Bancária</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Wallet */}
      {showWallet && (
        <FormField
          control={form.control}
          name="wallet_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carteira</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

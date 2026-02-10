import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addMonths } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Transaction,
  TransactionInsert,
  Category,
  CardTerminalInfo,
  CreditCard,
} from "@/hooks/useTransactions";
import { PaymentMethodFields } from "./PaymentMethodFields";

// Currency mask input for BRL
function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(value ? formatBRL(value) : "");

  function formatBRL(v: number): string {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) {
      setDisplay("");
      onChange(0);
      return;
    }
    const numeric = parseInt(raw, 10) / 100;
    setDisplay(formatBRL(numeric));
    onChange(numeric);
  }

  // Sync from outside (e.g. form reset)
  useEffect(() => {
    if (value === 0) setDisplay("");
    else setDisplay(formatBRL(value));
  }, [value]);

  return (
    <Input
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
    />
  );
}

const PAYMENT_METHODS = [
  "PIX",
  "Boleto",
  "Dinheiro",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Transferência",
] as const;

const RECURRING_FREQUENCIES = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "yearly", label: "Anual" },
] as const;

const transactionSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória").max(200),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  payment_date: z.date({ required_error: "Data de pagamento obrigatória" }),
  competence_date: z.date({ required_error: "Data de competência obrigatória" }),
  status: z.enum(["Pendente", "Pago"]),
  category: z.string().min(1, "Categoria obrigatória"),
  subcategory: z.string().optional(),
  subcategory2: z.string().optional(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  credit_card_id: z.string().optional(),
  wallet_id: z.string().optional(),
  card_terminal_id: z.string().optional(),
  supplier_id: z.string().optional(),
  client_id: z.string().optional(),
  contact_name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  barcode: z.string().max(100).optional(),
  attachment_url: z.string().url("URL inválida").max(500).or(z.literal("")).optional(),
  is_installment: z.boolean().default(false),
  installments_count: z.coerce.number().int().min(2).max(120).optional(),
  first_installment_amount: z.coerce.number().positive().optional(),
  is_recurring: z.boolean().default(false),
  recurring_frequency: z.string().optional(),
  recurring_end_date: z.date().optional(),
});

type FormData = z.infer<typeof transactionSchema>;

const transferSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória").max(200),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  payment_date: z.date({ required_error: "Data obrigatória" }),
  source_account_id: z.string().min(1, "Conta de origem obrigatória"),
  dest_account_id: z.string().min(1, "Conta de destino obrigatória"),
});

type TransferFormData = z.infer<typeof transferSchema>;

// Helper: grouped account options for transfer selects
function TransferAccountOptions({
  allAccounts,
  bankAccounts,
  wallets,
  creditCards,
}: {
  allAccounts?: AllAccounts;
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: CreditCard[];
}) {
  // If allAccounts is available, group by context (Pessoal / Company Name)
  if (allAccounts) {
    const contexts = new Map<string, { banks: typeof allAccounts.bankAccounts; wallets: typeof allAccounts.wallets; cards: typeof allAccounts.creditCards }>();
    
    const addToContext = (name: string) => {
      if (!contexts.has(name)) contexts.set(name, { banks: [], wallets: [], cards: [] });
      return contexts.get(name)!;
    };

    allAccounts.bankAccounts.forEach((a) => addToContext(a.company_name).banks.push(a));
    allAccounts.wallets.forEach((w) => addToContext(w.company_name).wallets.push(w));
    allAccounts.creditCards.forEach((c) => addToContext(c.company_name).cards.push(c));

    // Sort: "Pessoal" first
    const sorted = Array.from(contexts.entries()).sort(([a], [b]) => {
      if (a === "Pessoal") return -1;
      if (b === "Pessoal") return 1;
      return a.localeCompare(b);
    });

    return (
      <>
        {sorted.map(([contextName, accounts]) => (
          <SelectGroup key={contextName}>
            <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{contextName}</SelectLabel>
            {accounts.banks.map((a) => (
              <SelectItem key={`bank:${a.id}`} value={`bank:${a.id}`}>🏦 {a.name}</SelectItem>
            ))}
            {accounts.wallets.map((w) => (
              <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`}>👛 {w.name}</SelectItem>
            ))}
            {accounts.cards.map((c) => (
              <SelectItem key={`card:${c.id}`} value={`card:${c.id}`}>
                💳 {c.name}{c.last_four_digits ? ` •••• ${c.last_four_digits}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </>
    );
  }

  // Fallback: no allAccounts, use current context accounts
  return (
    <>
      {bankAccounts.length > 0 && (
        <SelectGroup>
          <SelectLabel>Contas Bancárias</SelectLabel>
          {bankAccounts.map((a) => (
            <SelectItem key={a.id} value={`bank:${a.id}`}>{a.name}</SelectItem>
          ))}
        </SelectGroup>
      )}
      {wallets.length > 0 && (
        <SelectGroup>
          <SelectLabel>Carteiras</SelectLabel>
          {wallets.map((w) => (
            <SelectItem key={w.id} value={`wallet:${w.id}`}>{w.name}</SelectItem>
          ))}
        </SelectGroup>
      )}
      {creditCards.length > 0 && (
        <SelectGroup>
          <SelectLabel>Cartões de Crédito</SelectLabel>
          {creditCards.map((c) => (
            <SelectItem key={c.id} value={`card:${c.id}`}>
              {c.name}{c.last_four_digits ? ` •••• ${c.last_four_digits}` : ""}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
    </>
  );
}

interface AllAccounts {
  bankAccounts: { id: string; name: string; company_id: string | null; company_name: string }[];
  wallets: { id: string; name: string; company_id: string | null; company_name: string }[];
  creditCards: { id: string; name: string; last_four_digits: string | null; company_id: string | null; company_name: string }[];
}

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  editTransaction?: Transaction | null;
  onSave: (data: TransactionInsert) => Promise<boolean>;
  onSaveMultiple: (data: TransactionInsert[]) => Promise<boolean>;
  onUpdate: (id: string, data: Partial<Transaction>) => Promise<boolean>;
  bankAccounts: { id: string; name: string }[];
  creditCards: CreditCard[];
  wallets: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  categories: Category[];
  cardTerminals: CardTerminalInfo[];
  allAccounts?: AllAccounts;
}

export function TransactionFormModal({
  open,
  onClose,
  editTransaction,
  onSave,
  onSaveMultiple,
  onUpdate,
  bankAccounts,
  creditCards,
  wallets,
  suppliers,
  clients,
  categories,
  cardTerminals,
  allAccounts,
}: TransactionFormModalProps) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [activeTab, setActiveTab] = useState<"receita" | "despesa" | "transferencia">("despesa");
  const [saving, setSaving] = useState(false);

  const isEditing = !!editTransaction;

  // Main form
  const form = useForm<FormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      payment_date: new Date(),
      competence_date: new Date(),
      status: "Pendente",
      category: "",
      subcategory: "",
      subcategory2: "",
      payment_method: "",
      bank_account_id: "",
      credit_card_id: "",
      wallet_id: "",
      supplier_id: "",
      client_id: "",
      contact_name: "",
      notes: "",
      barcode: "",
      attachment_url: "",
      is_installment: false,
      installments_count: 2,
      first_installment_amount: undefined,
      is_recurring: false,
      recurring_frequency: "monthly",
      recurring_end_date: undefined,
    },
  });

  // Transfer form
  const transferForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      description: "",
      amount: 0,
      payment_date: new Date(),
      source_account_id: "",
      dest_account_id: "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editTransaction && open) {
      setActiveTab(editTransaction.type);
      form.reset({
        description: editTransaction.description,
        amount: editTransaction.amount,
        payment_date: new Date(editTransaction.payment_date + "T00:00:00"),
        competence_date: new Date(editTransaction.competence_date + "T00:00:00"),
        status: editTransaction.status,
        category: editTransaction.category,
        subcategory: editTransaction.subcategory || "",
        subcategory2: editTransaction.subcategory2 || "",
        payment_method: editTransaction.payment_method || "",
        bank_account_id: editTransaction.bank_account_id || "",
        credit_card_id: editTransaction.credit_card_id || "",
        wallet_id: editTransaction.wallet_id || "",
        supplier_id: editTransaction.supplier_id || "",
        client_id: editTransaction.client_id || "",
        contact_name: editTransaction.contact_name || "",
        notes: editTransaction.notes || "",
        barcode: editTransaction.barcode || "",
        attachment_url: editTransaction.attachment_url || "",
        is_installment: false,
        is_recurring: false,
        recurring_frequency: "monthly",
        first_installment_amount: undefined,
      });
    } else if (!editTransaction && open) {
      form.reset();
      transferForm.reset();
    }
  }, [editTransaction, open, form, transferForm]);

  // Categories cascade
  const rootCategories = categories.filter((c) => !c.parent_id);
  const watchCategory = form.watch("category");
  const watchSubcategory = form.watch("subcategory");
  const subCategories = categories.filter((c) => c.parent_id === watchCategory);
  const subSubCategories = categories.filter((c) => c.parent_id === watchSubcategory);

  const watchPaymentMethod = form.watch("payment_method");
  const isCardPayment = watchPaymentMethod === "Cartão de Crédito" || watchPaymentMethod === "Cartão de Débito";
  const showCreditCard = !isCardPayment && watchPaymentMethod === "Cartão de Crédito"; // legacy, handled by PaymentMethodFields now
  const showBankAccount = false; // handled by PaymentMethodFields
  const showWallet = false; // handled by PaymentMethodFields

  const handleMainSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    const baseData: TransactionInsert = {
      user_id: user.id,
      company_id: isPersonal ? null : selectedCompanyId,
      type: activeTab as "receita" | "despesa",
      description: data.description.trim(),
      amount: data.amount,
      payment_date: format(data.payment_date, "yyyy-MM-dd"),
      competence_date: format(data.competence_date, "yyyy-MM-dd"),
      status: data.status,
      category: data.category,
      subcategory: data.subcategory || null,
      subcategory2: data.subcategory2 || null,
      payment_method: data.payment_method || null,
      bank_account_id: data.bank_account_id || null,
      credit_card_id: data.credit_card_id || null,
      wallet_id: data.wallet_id || null,
      card_terminal_id: data.card_terminal_id || null,
      supplier_id: activeTab === "despesa" && data.supplier_id ? data.supplier_id : null,
      client_id: activeTab === "receita" && data.client_id ? data.client_id : null,
      contact_name: data.contact_name?.trim() || null,
      notes: data.notes?.trim() || null,
      barcode: data.barcode?.trim() || null,
      attachment_url: data.attachment_url?.trim() || null,
    };

    let success = false;

    if (isEditing) {
      const { user_id, company_id, ...updateData } = baseData;
      success = await onUpdate(editTransaction.id, updateData);
    } else if (data.is_installment && data.installments_count && data.installments_count >= 2) {
      const seriesId = crypto.randomUUID();
      const total = data.amount;
      const count = data.installments_count;
      let firstAmount: number;
      let restAmount: number;

      if (data.first_installment_amount && data.first_installment_amount > 0 && data.first_installment_amount < total) {
        firstAmount = Math.round(data.first_installment_amount * 100) / 100;
        restAmount = Math.round(((total - firstAmount) / (count - 1)) * 100) / 100;
      } else {
        firstAmount = Math.round((total / count) * 100) / 100;
        restAmount = firstAmount;
      }

      const installments: TransactionInsert[] = [];
      for (let i = 0; i < count; i++) {
        const payDate = addMonths(data.payment_date, i);
        const compDate = addMonths(data.competence_date, i);
        installments.push({
          ...baseData,
          amount: i === 0 ? firstAmount : restAmount,
          original_amount: total,
          payment_date: format(payDate, "yyyy-MM-dd"),
          competence_date: format(compDate, "yyyy-MM-dd"),
          series_id: seriesId,
          installment_number: i + 1,
          installments_total: count,
        });
      }
      success = await onSaveMultiple(installments);
    } else if (data.is_recurring && data.recurring_frequency) {
      const seriesId = crypto.randomUUID();
      const frequency = data.recurring_frequency;
      const endDate = data.recurring_end_date;

      const getNextDate = (base: Date, index: number): Date => {
        switch (frequency) {
          case "weekly": {
            const d = new Date(base);
            d.setDate(d.getDate() + index * 7);
            return d;
          }
          case "biweekly": {
            const d = new Date(base);
            d.setDate(d.getDate() + index * 14);
            return d;
          }
          case "yearly":
            return addMonths(base, index * 12);
          default:
            return addMonths(base, index);
        }
      };

      const maxOccurrences = frequency === "weekly" ? 52 : frequency === "biweekly" ? 26 : frequency === "yearly" ? 5 : 12;
      const recurrings: TransactionInsert[] = [];

      for (let i = 0; i < maxOccurrences; i++) {
        const payDate = getNextDate(data.payment_date, i);
        const compDate = getNextDate(data.competence_date, i);
        if (endDate && payDate > endDate) break;

        recurrings.push({
          ...baseData,
          amount: data.amount,
          payment_date: format(payDate, "yyyy-MM-dd"),
          competence_date: format(compDate, "yyyy-MM-dd"),
          series_id: seriesId,
          installment_number: i + 1,
        });
      }

      if (recurrings.length > 0) {
        success = await onSaveMultiple(recurrings);
      }
    } else {
      success = await onSave(baseData);
    }

    setSaving(false);
    if (success) onClose();
  };

  const handleTransferSubmit = async (data: TransferFormData) => {
    if (!user) return;
    setSaving(true);

    const parseAccountId = (combined: string) => {
      const [type, ...idParts] = combined.split(":");
      const id = idParts.join(":");
      return {
        bank_account_id: type === "bank" ? id : null,
        wallet_id: type === "wallet" ? id : null,
        credit_card_id: type === "card" ? id : null,
      };
    };

    // Determine company_id from the selected account
    const getCompanyIdForAccount = (combined: string): string | null => {
      if (!allAccounts) return isPersonal ? null : selectedCompanyId;
      const [type, ...idParts] = combined.split(":");
      const id = idParts.join(":");
      if (type === "bank") {
        const acc = allAccounts.bankAccounts.find((a) => a.id === id);
        return acc?.company_id ?? null;
      }
      if (type === "wallet") {
        const acc = allAccounts.wallets.find((w) => w.id === id);
        return acc?.company_id ?? null;
      }
      if (type === "card") {
        const acc = allAccounts.creditCards.find((c) => c.id === id);
        return acc?.company_id ?? null;
      }
      return null;
    };

    const transferId = crypto.randomUUID();
    const dateStr = format(data.payment_date, "yyyy-MM-dd");
    const sourceAccount = parseAccountId(data.source_account_id);
    const destAccount = parseAccountId(data.dest_account_id);
    const sourceCompanyId = getCompanyIdForAccount(data.source_account_id);
    const destCompanyId = getCompanyIdForAccount(data.dest_account_id);

    const transfers: TransactionInsert[] = [
      {
        user_id: user.id,
        company_id: sourceCompanyId,
        type: "despesa",
        description: data.description.trim(),
        amount: data.amount,
        payment_date: dateStr,
        competence_date: dateStr,
        status: "Pago",
        category: "Transferência",
        ...sourceAccount,
        transfer_id: transferId,
      },
      {
        user_id: user.id,
        company_id: destCompanyId,
        type: "receita",
        description: data.description.trim(),
        amount: data.amount,
        payment_date: dateStr,
        competence_date: dateStr,
        status: "Pago",
        category: "Transferência",
        ...destAccount,
        transfer_id: transferId,
      },
    ];

    const success = await onSaveMultiple(transfers);
    setSaving(false);
    if (success) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Lançamento" : "Novo Lançamento"}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          {!isEditing && (
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="despesa">Despesa</TabsTrigger>
              <TabsTrigger value="transferencia">Transf. entre Contas</TabsTrigger>
            </TabsList>
          )}

          {/* Receita / Despesa form */}
          <TabsContent value="receita">
            <MainFormContent
              form={form}
              activeTab="receita"
              saving={saving}
              isEditing={isEditing}
              onSubmit={handleMainSubmit}
              rootCategories={rootCategories.filter(c => c.type === "receita" || c.type === "ambos")}
              subCategories={subCategories}
              subSubCategories={subSubCategories}
              watchPaymentMethod={watchPaymentMethod}
              bankAccounts={bankAccounts}
              creditCards={creditCards}
              wallets={wallets}
              clients={clients}
              suppliers={suppliers}
              cardTerminals={cardTerminals}
            />
          </TabsContent>

          <TabsContent value="despesa">
            <MainFormContent
              form={form}
              activeTab="despesa"
              saving={saving}
              isEditing={isEditing}
              onSubmit={handleMainSubmit}
              rootCategories={rootCategories.filter(c => c.type === "despesa" || c.type === "ambos")}
              subCategories={subCategories}
              subSubCategories={subSubCategories}
              watchPaymentMethod={watchPaymentMethod}
              bankAccounts={bankAccounts}
              creditCards={creditCards}
              wallets={wallets}
              clients={clients}
              suppliers={suppliers}
              cardTerminals={cardTerminals}
            />
          </TabsContent>

          {/* Transfer form */}
          <TabsContent value="transferencia">
            <Form {...transferForm}>
              <form
                onSubmit={transferForm.handleSubmit(handleTransferSubmit)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={transferForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Transferência entre contas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

           <FormField
                  control={transferForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={transferForm.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                : "Selecione"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="source_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta de Origem</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <TransferAccountOptions allAccounts={allAccounts} bankAccounts={bankAccounts} wallets={wallets} creditCards={creditCards} />
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={transferForm.control}
                    name="dest_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta de Destino</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <TransferAccountOptions allAccounts={allAccounts} bankAccounts={bankAccounts} wallets={wallets} creditCards={creditCards} />
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Realizar Transferência
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main form (Receita/Despesa) ──────────────────────────────
interface MainFormContentProps {
  form: ReturnType<typeof useForm<FormData>>;
  activeTab: "receita" | "despesa";
  saving: boolean;
  isEditing: boolean;
  onSubmit: (data: FormData) => void;
  rootCategories: Category[];
  subCategories: Category[];
  subSubCategories: Category[];
  watchPaymentMethod: string | undefined;
  bankAccounts: { id: string; name: string }[];
  creditCards: CreditCard[];
  wallets: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  cardTerminals: CardTerminalInfo[];
}

function MainFormContent({
  form,
  activeTab,
  saving,
  isEditing,
  onSubmit,
  rootCategories,
  subCategories,
  subSubCategories,
  watchPaymentMethod,
  bankAccounts,
  creditCards,
  wallets,
  clients,
  suppliers,
  cardTerminals,
}: MainFormContentProps) {
  const watchInstallment = form.watch("is_installment");
  const watchRecurring = form.watch("is_recurring");
  const [customFirstInstallment, setCustomFirstInstallment] = useState(false);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        {/* Description + Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Aluguel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$) *</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="payment_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Pagamento *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="competence_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Competência *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Status + Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Forma de Pagamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Category cascade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria *</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("subcategory", "");
                    form.setValue("subcategory2", "");
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {rootCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {subCategories.length > 0 && (
            <FormField
              control={form.control}
              name="subcategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategoria</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("subcategory2", "");
                    }}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {subSubCategories.length > 0 && (
            <FormField
              control={form.control}
              name="subcategory2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-subcategoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subSubCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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

        {/* Contextual payment method fields */}
        <PaymentMethodFields
          form={form}
          activeTab={activeTab}
          paymentMethod={watchPaymentMethod}
          bankAccounts={bankAccounts}
          creditCards={creditCards}
          wallets={wallets}
          cardTerminals={cardTerminals}
        />

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeTab === "despesa" ? (
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do contato</FormLabel>
                <FormControl>
                  <Input placeholder="Alternativo ao select" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes, barcode, attachment */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Opcional..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de barras</FormLabel>
                <FormControl>
                  <Input placeholder="Opcional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="attachment_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anexo (URL)</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Installments / Recurring toggle */}
        {!isEditing && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            {/* Installment toggle */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="installment-toggle"
                  checked={watchInstallment}
                  onCheckedChange={(checked) => {
                    form.setValue("is_installment", checked);
                    if (checked) form.setValue("is_recurring", false);
                  }}
                />
                <Label htmlFor="installment-toggle">Parcelado?</Label>
              </div>
              {watchInstallment && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
                  <FormField
                    control={form.control}
                    name="installments_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de parcelas</FormLabel>
                        <FormControl>
                          <Input type="number" min="2" max="120" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-3">
                    <Switch
                      id="custom-first"
                      checked={customFirstInstallment}
                      onCheckedChange={setCustomFirstInstallment}
                    />
                    <Label htmlFor="custom-first" className="text-sm">Valor da 1ª parcela diferente?</Label>
                  </div>
                  {customFirstInstallment && (
                    <FormField
                      control={form.control}
                      name="first_installment_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor da 1ª parcela (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="Ex: 150.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Recurring toggle (mutually exclusive with installment) */}
            {!watchInstallment && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="recurring-toggle"
                    checked={watchRecurring}
                    onCheckedChange={(checked) => {
                      form.setValue("is_recurring", checked);
                      if (checked) form.setValue("is_installment", false);
                    }}
                  />
                  <Label htmlFor="recurring-toggle">Lançamento Fixo / Recorrente?</Label>
                </div>
                {watchRecurring && (
                  <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
                    <FormField
                      control={form.control}
                      name="recurring_frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "monthly"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RECURRING_FREQUENCIES.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="recurring_end_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de fim (opcional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                    : "Sem data de fim"}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar Alterações" : "Criar Lançamento"}
        </Button>
      </form>
    </Form>
  );
}

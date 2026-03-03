import { useState, useEffect, useRef, useCallback } from "react";
import type { FormFieldSettings } from "@/hooks/useFormFieldSettings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addMonths, addDays } from "date-fns";
import { CalendarIcon, Loader2, User, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ptBR } from "date-fns/locale";
import { cn, addBusinessDays } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany, type Company } from "@/contexts/CompanyContext";
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
import { InstallmentPreviewTable } from "./InstallmentPreviewTable";
import { SeriesInstallmentTable } from "./SeriesInstallmentTable";
import { CategorySelectWithCreate } from "./CategorySelectWithCreate";
import { ContactSelectWithCreate } from "./ContactSelectWithCreate";

interface RateInfo {
  installments: number;
  rate: number;
}

function parseRatesInfo(ratesInfo: string | null): RateInfo[] {
  if (!ratesInfo) return [];
  try {
    const parsed = JSON.parse(ratesInfo);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

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
  "Cheque",
  "Depósito",
  "Débito Automático",
  "Outro",
] as const;

const RECURRING_FREQUENCIES = [
  { value: "monthly", label: "Mensal" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "custom_days", label: "A cada X dias" },
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
  interest_rate: z.coerce.number().min(0).max(100).default(0),
  first_installment_amount: z.coerce.number().positive().optional(),
  installment_interval_type: z.enum(["monthly", "custom_days"]).default("monthly"),
  installment_custom_days: z.coerce.number().int().min(1).max(365).optional(),
  is_recurring: z.boolean().default(false),
  recurring_frequency: z.string().optional(),
  recurring_custom_days: z.coerce.number().int().min(1).max(365).optional(),
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
  if (allAccounts) {
    const contexts = new Map<string, { banks: typeof allAccounts.bankAccounts; wallets: typeof allAccounts.wallets; cards: typeof allAccounts.creditCards }>();
    
    const addToContext = (name: string) => {
      if (!contexts.has(name)) contexts.set(name, { banks: [], wallets: [], cards: [] });
      return contexts.get(name)!;
    };

    allAccounts.bankAccounts.forEach((a) => addToContext(a.company_name).banks.push(a));
    allAccounts.wallets.forEach((w) => addToContext(w.company_name).wallets.push(w));
    allAccounts.creditCards.forEach((c) => addToContext(c.company_name).cards.push(c));

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
  onUpdateMultiple?: (updates: Array<{ id: string; amount: number; payment_date?: string }>) => Promise<boolean>;
  bankAccounts: { id: string; name: string }[];
  creditCards: CreditCard[];
  wallets: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  categories: Category[];
  cardTerminals: CardTerminalInfo[];
  allCardTerminals?: (CardTerminalInfo & { company_id: string | null })[];
  allAccounts?: AllAccounts;
  companies?: Company[];
  fieldSettings?: FormFieldSettings;
}

export function TransactionFormModal({
  open,
  onClose,
  editTransaction,
  onSave,
  onSaveMultiple,
  onUpdate,
  onUpdateMultiple,
  bankAccounts,
  creditCards,
  wallets,
  suppliers,
  clients,
  categories,
  cardTerminals,
  allCardTerminals,
  allAccounts,
  companies = [],
  fieldSettings,
}: TransactionFormModalProps) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [activeTab, setActiveTab] = useState<"receita" | "despesa" | "transferencia">("despesa");
  const [saving, setSaving] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState<string | null>(null);
  const [formCategories, setFormCategories] = useState<Category[]>([]);
  const [customInstallmentAmounts, setCustomInstallmentAmounts] = useState<Record<number, number>>({});
  const [customInstallmentDates, setCustomInstallmentDates] = useState<Record<number, Date>>({});
  const [seriesUpdates, setSeriesUpdates] = useState<Array<{ id: string; amount: number; payment_date?: string }>>([]);

  const fetchFormCategories = useCallback(async () => {
    if (!user) return;
    let query = supabase.from("categories").select("*");
    if (formCompanyId === null) {
      query = query.is("company_id", null);
    } else {
      query = query.eq("company_id", formCompanyId);
    }
    const { data } = await query.order("name");
    setFormCategories(data || []);
  }, [user, formCompanyId]);

  useEffect(() => {
    if (open) fetchFormCategories();
  }, [fetchFormCategories, open, formCompanyId]);

  const isEditing = !!editTransaction;
  const formIsPersonal = formCompanyId === null;

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
      interest_rate: 0,
      first_installment_amount: undefined,
      is_recurring: false,
      recurring_frequency: "monthly",
      recurring_end_date: undefined,
    },
  });

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

  const paymentDateManuallyEdited = useRef(false);

  const watchCompetenceDate = form.watch("competence_date");
  useEffect(() => {
    if (!paymentDateManuallyEdited.current && watchCompetenceDate) {
      form.setValue("payment_date", watchCompetenceDate);
    }
  }, [watchCompetenceDate, form]);

  useEffect(() => {
    if (open) {
      paymentDateManuallyEdited.current = false;
      setCustomInstallmentAmounts({});
      setCustomInstallmentDates({});
      setSeriesUpdates([]);
      if (editTransaction) {
        setFormCompanyId(editTransaction.company_id ?? null);
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
          card_terminal_id: editTransaction.card_terminal_id || "",
          supplier_id: editTransaction.supplier_id || "",
          client_id: editTransaction.client_id || "",
          contact_name: editTransaction.contact_name || "",
          notes: editTransaction.notes || "",
          barcode: editTransaction.barcode || "",
          attachment_url: editTransaction.attachment_url || "",
          is_installment: false,
          is_recurring: false,
          recurring_frequency: "monthly",
          interest_rate: 0,
          first_installment_amount: undefined,
        });
        paymentDateManuallyEdited.current = true;
      } else {
        setFormCompanyId(selectedCompanyId);
        setActiveTab(isPersonal ? "despesa" : "receita");
        form.reset({
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
          card_terminal_id: "",
          supplier_id: "",
          client_id: "",
          contact_name: "",
          notes: "",
          barcode: "",
          attachment_url: "",
          is_installment: false,
          installments_count: 2,
          interest_rate: 0,
          first_installment_amount: undefined,
          installment_interval_type: "monthly",
          installment_custom_days: undefined,
          is_recurring: false,
          recurring_frequency: "monthly",
          recurring_custom_days: undefined,
          recurring_end_date: undefined,
        });
        transferForm.reset({
          description: "",
          amount: 0,
          payment_date: new Date(),
          source_account_id: "",
          dest_account_id: "",
        });
      }
    }
  }, [editTransaction, open]);

  const handleContextChange = (companyId: string | null) => {
    if (isEditing) return; // Block context change during editing to preserve account fields
    setFormCompanyId(companyId);
    setActiveTab(companyId === null ? "despesa" : "receita");
    // Clear account and category selections when context changes
    form.setValue("bank_account_id", "");
    form.setValue("credit_card_id", "");
    form.setValue("wallet_id", "");
    form.setValue("card_terminal_id", "");
    form.setValue("category", "");
    form.setValue("subcategory", "");
    form.setValue("subcategory2", "");
  };

  const rootCategories = formCategories.filter((c) => !c.parent_id);
  const watchCategory = form.watch("category");
  const watchSubcategory = form.watch("subcategory");
  const subCategories = formCategories.filter((c) => c.parent_id === watchCategory);
  const subSubCategories = formCategories.filter((c) => c.parent_id === watchSubcategory);

  // Filter accounts by form context (formCompanyId)
  const filteredBankAccounts = allAccounts
    ? allAccounts.bankAccounts
        .filter((a) => formCompanyId === null ? a.company_id === null : a.company_id === formCompanyId)
        .map(({ id, name }) => ({ id, name }))
    : bankAccounts;
  const filteredWallets = allAccounts
    ? allAccounts.wallets
        .filter((w) => formCompanyId === null ? w.company_id === null : w.company_id === formCompanyId)
        .map(({ id, name }) => ({ id, name }))
    : wallets;
  const filteredCreditCards = allAccounts
    ? allAccounts.creditCards
        .filter((c) => formCompanyId === null ? c.company_id === null : c.company_id === formCompanyId)
        .map((c) => {
          const full = creditCards.find((cc) => cc.id === c.id);
          return full || { id: c.id, name: c.name, last_four_digits: c.last_four_digits, closing_day: 0, due_day: 0, bank_account_id: "" };
        })
    : creditCards;

  // Filter card terminals by form context
  const filteredCardTerminals = allCardTerminals
    ? allCardTerminals
        .filter((t) => formCompanyId === null ? t.company_id === null : t.company_id === formCompanyId)
        .map(({ company_id, ...rest }) => rest as CardTerminalInfo)
    : cardTerminals;

  const watchPaymentMethod = form.watch("payment_method");

  const handleMainSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    // --- Terminal MDR logic (receita via card terminal) ---
    const isReceita = activeTab === "receita";
    const isCardPayment = data.payment_method === "Cartão de Crédito" || data.payment_method === "Cartão de Débito";
    const selectedTerminal = isReceita && isCardPayment && data.card_terminal_id
      ? filteredCardTerminals.find((t) => t.id === data.card_terminal_id)
      : null;

    let finalAmount = data.amount;
    let originalAmount: number | null = null;
    let finalPaymentDate = data.payment_date;

    if (selectedTerminal) {
      const isDebit = data.payment_method === "Cartão de Débito";

      // Determine rate
      let rate: number;
      if (isDebit) {
        rate = selectedTerminal.debit_rate ?? 0;
      } else {
        // Check installment-specific rate from rates_info
        const fallbackRate = selectedTerminal.credit_rate ?? 0;
        if (data.is_installment && data.installments_count && data.installments_count >= 2) {
          const rates = parseRatesInfo(selectedTerminal.rates_info);
          const match = rates.find((r) => r.installments === data.installments_count);
          rate = match ? match.rate : fallbackRate;
        } else {
          rate = fallbackRate;
        }
      }

      // Calculate net amount
      const feeAmount = Math.round(data.amount * (rate / 100) * 100) / 100;
      finalAmount = Math.round((data.amount - feeAmount) * 100) / 100;
      originalAmount = data.amount;

      // Calculate settlement date (D+)
      const settlementDays = isDebit
        ? (selectedTerminal.settlement_days_debit ?? 1)
        : (selectedTerminal.settlement_days_credit ?? 2);
      finalPaymentDate = addBusinessDays(data.competence_date, settlementDays);
    }

    const baseData: TransactionInsert = {
      user_id: user.id,
      company_id: formCompanyId,
      type: activeTab as "receita" | "despesa",
      description: data.description.trim(),
      amount: finalAmount,
      original_amount: originalAmount,
      payment_date: format(finalPaymentDate, "yyyy-MM-dd"),
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
      // Preserve original type and status to prevent race conditions
      updateData.type = editTransaction.type;
      updateData.status = editTransaction.status;
      success = await onUpdate(editTransaction.id, updateData);
      // Also apply series installment amount changes if any
      if (success && seriesUpdates.length > 0 && onUpdateMultiple) {
        await onUpdateMultiple(seriesUpdates);
      }
    } else if (selectedTerminal) {
      const isDebit = data.payment_method === "Cartão de Débito";
      if (!isDebit && data.is_installment && data.installments_count && data.installments_count >= 2) {
        // Credit installment via terminal: generate N individual transactions
        const count = data.installments_count;
        const grossPerInstallment = Math.round((data.amount / count) * 100) / 100;

        // Determine installment-specific rate
        const fallbackRate = selectedTerminal.credit_rate ?? 0;
        const rates = parseRatesInfo(selectedTerminal.rates_info);
        const matchRate = rates.find((r) => r.installments === count);
        const rate = matchRate ? matchRate.rate : fallbackRate;

        const feePerInstallment = Math.round(grossPerInstallment * (rate / 100) * 100) / 100;
        const netPerInstallment = Math.round((grossPerInstallment - feePerInstallment) * 100) / 100;
        const settlementDays = selectedTerminal.settlement_days_credit ?? 30;
        const autoAnticipation = (selectedTerminal as any).auto_anticipation ?? false;
        const seriesId = crypto.randomUUID();

        // Rounding: floor all installments, put remainder in last one
        const grossFloor = Math.floor((data.amount / count) * 100) / 100;
        const grossLast = Math.round((data.amount - grossFloor * (count - 1)) * 100) / 100;

        const installments: TransactionInsert[] = [];
        for (let i = 0; i < count; i++) {
          const isLast = i === count - 1;
          const thisGross = isLast ? grossLast : grossFloor;
          const thisFee = Math.round(thisGross * (rate / 100) * 100) / 100;
          const thisNet = Math.round((thisGross - thisFee) * 100) / 100;

          // If auto_anticipation: all installments on the same D+X (business days)
          // Otherwise: 30-day intervals + D+X business days settlement
          const payDate = autoAnticipation
            ? addBusinessDays(data.competence_date, settlementDays)
            : addBusinessDays(addDays(data.competence_date, 30 * (i + 1)), settlementDays);
          installments.push({
            ...baseData,
            amount: thisNet,
            original_amount: thisGross,
            payment_date: format(payDate, "yyyy-MM-dd"),
            competence_date: format(data.competence_date, "yyyy-MM-dd"),
            series_id: seriesId,
            installment_number: i + 1,
            installments_total: count,
            installments: count,
            card_terminal_id: selectedTerminal.id,
          });
        }
        success = await onSaveMultiple(installments);
      } else {
        // Debit or credit à vista: single transaction — no installment metadata for debit
        success = await onSave(baseData);
      }
    } else if (data.is_installment && data.installments_count && data.installments_count >= 2) {
      const seriesId = crypto.randomUUID();
      const total = data.amount;
      const count = data.installments_count;
      const interestRate = Number(data.interest_rate) || 0;
      let installmentAmount: number;

      if (interestRate > 0) {
        // Price table (French system) - fixed installments with compound interest
        const i = interestRate / 100;
        installmentAmount = Math.round(total * (i * Math.pow(1 + i, count)) / (Math.pow(1 + i, count) - 1) * 100) / 100;
      } else {
        installmentAmount = Math.round((total / count) * 100) / 100;
      }

      const hasCustomAmounts = Object.keys(customInstallmentAmounts).length > 0;
      const instIntervalType = data.installment_interval_type || "monthly";
      const instCustomDays = data.installment_custom_days || 30;
      const installments: TransactionInsert[] = [];

      for (let idx = 0; idx < count; idx++) {
        const defaultPayDate = instIntervalType === "custom_days"
          ? addDays(data.payment_date, idx * instCustomDays)
          : addMonths(data.payment_date, idx);
        const payDate = customInstallmentDates[idx + 1] ?? defaultPayDate;
        const compDate = data.competence_date;
        const instNum = idx + 1;

        let amount = installmentAmount;
        if (hasCustomAmounts && interestRate === 0) {
          if (customInstallmentAmounts[instNum] !== undefined) {
            amount = customInstallmentAmounts[instNum];
          } else {
            // Redistribute: calculate remaining for non-edited
            const editedIndices = Object.keys(customInstallmentAmounts).map(Number);
            const customSum = editedIndices.reduce((s, k) => s + (customInstallmentAmounts[k] || 0), 0);
            const remaining = total - customSum;
            const nonEditedCount = count - editedIndices.length;
            amount = nonEditedCount > 0 ? Math.round((remaining / nonEditedCount) * 100) / 100 : 0;
          }
        }

        installments.push({
          ...baseData,
          amount,
          original_amount: total,
          payment_date: format(payDate, "yyyy-MM-dd"),
          competence_date: format(compDate, "yyyy-MM-dd"),
          series_id: seriesId,
          installment_number: instNum,
          installments_total: count,
        });
      }
      success = await onSaveMultiple(installments);
    } else if (data.is_recurring && data.recurring_frequency) {
      const seriesId = crypto.randomUUID();
      const frequency = data.recurring_frequency;
      const endDate = data.recurring_end_date;

      const customDaysInterval = data.recurring_custom_days || 30;

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
          case "custom_days": {
            const d = new Date(base);
            d.setDate(d.getDate() + index * customDaysInterval);
            return d;
          }
          case "yearly":
            return addMonths(base, index * 12);
          default:
            return addMonths(base, index);
        }
      };

      const maxOccurrences = frequency === "weekly" ? 52 : frequency === "biweekly" ? 26 : frequency === "custom_days" ? Math.floor(365 / customDaysInterval) : frequency === "yearly" ? 5 : 12;
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

        {/* Context selector */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Contexto</Label>
          <Select
            value={formCompanyId ?? "__pessoal__"}
            onValueChange={(v) => handleContextChange(v === "__pessoal__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__pessoal__">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Pessoal
                </span>
              </SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
              bankAccounts={filteredBankAccounts}
              creditCards={filteredCreditCards}
              wallets={filteredWallets}
              clients={clients}
              suppliers={suppliers}
               cardTerminals={filteredCardTerminals}
              paymentDateManuallyEdited={paymentDateManuallyEdited}
              formCompanyId={formCompanyId}
              onCategoryCreated={fetchFormCategories}
              fieldSettings={fieldSettings}
              customInstallmentAmounts={customInstallmentAmounts}
              onCustomInstallmentAmountsChange={setCustomInstallmentAmounts}
              customInstallmentDates={customInstallmentDates}
              onCustomInstallmentDatesChange={setCustomInstallmentDates}
              editTransaction={editTransaction}
              onSeriesUpdatesChange={setSeriesUpdates}
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
              bankAccounts={filteredBankAccounts}
              creditCards={filteredCreditCards}
              wallets={filteredWallets}
              clients={clients}
              suppliers={suppliers}
               cardTerminals={filteredCardTerminals}
              paymentDateManuallyEdited={paymentDateManuallyEdited}
              formCompanyId={formCompanyId}
              onCategoryCreated={fetchFormCategories}
              fieldSettings={fieldSettings}
              customInstallmentAmounts={customInstallmentAmounts}
              onCustomInstallmentAmountsChange={setCustomInstallmentAmounts}
              customInstallmentDates={customInstallmentDates}
              onCustomInstallmentDatesChange={setCustomInstallmentDates}
              editTransaction={editTransaction}
              onSeriesUpdatesChange={setSeriesUpdates}
            />
          </TabsContent>

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
  paymentDateManuallyEdited: React.MutableRefObject<boolean>;
  formCompanyId: string | null;
  onCategoryCreated: () => Promise<void>;
  fieldSettings?: FormFieldSettings;
  customInstallmentAmounts: Record<number, number>;
  onCustomInstallmentAmountsChange: (amounts: Record<number, number>) => void;
  customInstallmentDates: Record<number, Date>;
  onCustomInstallmentDatesChange: (dates: Record<number, Date>) => void;
  editTransaction?: Transaction | null;
  onSeriesUpdatesChange: (updates: Array<{ id: string; amount: number; payment_date?: string }>) => void;
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
  paymentDateManuallyEdited,
  formCompanyId,
  onCategoryCreated,
  fieldSettings,
  customInstallmentAmounts,
  onCustomInstallmentAmountsChange,
  customInstallmentDates,
  onCustomInstallmentDatesChange,
  editTransaction,
  onSeriesUpdatesChange,
}: MainFormContentProps) {
  const watchInstallment = form.watch("is_installment");
  const watchRecurring = form.watch("is_recurring");
  const watchAmount = form.watch("amount");
  const watchInstallmentsCount = form.watch("installments_count");
  const watchInterestRate = form.watch("interest_rate");
  const watchPaymentDate = form.watch("payment_date");
  const watchIntervalType = form.watch("installment_interval_type");
  const watchCustomDays = form.watch("installment_custom_days");
  const watchCardTerminalId = form.watch("card_terminal_id");
  const watchPaymentMethodMain = form.watch("payment_method");

  // Terminal-aware preview: compute net amount and D+N interval for all terminal scenarios
  const terminalPreview = (() => {
    if (!watchCardTerminalId || !watchAmount) return null;
    const terminal = cardTerminals.find((t) => t.id === watchCardTerminalId);
    if (!terminal) return null;

    const isDebit = watchPaymentMethodMain === "Cartão de Débito";
    const isCredit = watchPaymentMethodMain === "Cartão de Crédito";
    if (!isDebit && !isCredit) return null;

    const isInstallment = isCredit && watchInstallmentsCount && watchInstallmentsCount >= 2;
    const autoAnticipation = (terminal as any).auto_anticipation ?? false;

    let rate: number;
    let settlementDays: number;

    if (isDebit) {
      rate = terminal.debit_rate ?? 0;
      settlementDays = terminal.settlement_days_debit ?? 1;
    } else if (isInstallment) {
      const fallbackRate = terminal.credit_rate ?? 0;
      const rates = parseRatesInfo(terminal.rates_info);
      const match = rates.find((r) => r.installments === watchInstallmentsCount);
      rate = match ? match.rate : fallbackRate;
      settlementDays = terminal.settlement_days_credit ?? 30;
    } else {
      // Credit à vista
      rate = terminal.credit_rate ?? 0;
      settlementDays = terminal.settlement_days_credit ?? 30;
    }

    const feeAmount = Math.round(watchAmount * (rate / 100) * 100) / 100;
    const netTotal = Math.round((watchAmount - feeAmount) * 100) / 100;

    return { netTotal, settlementDays, isDebit, isSinglePayment: !isInstallment, rate, autoAnticipation };
  })();

  // Calculate Price table installment preview
  const interestPreview = (() => {
    if (!watchInstallment || !watchAmount || !watchInstallmentsCount || watchInstallmentsCount < 2) return null;
    const rate = watchInterestRate || 0;
    const n = watchInstallmentsCount;
    const pv = watchAmount;
    if (rate > 0) {
      const i = rate / 100;
      const pmt = Math.round(pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) * 100) / 100;
      const totalWithInterest = Math.round(pmt * n * 100) / 100;
      const totalInterest = Math.round((totalWithInterest - pv) * 100) / 100;
      return { pmt, totalWithInterest, totalInterest };
    }
    const pmt = Math.round((pv / n) * 100) / 100;
    return { pmt, totalWithInterest: Math.round(pmt * n * 100) / 100, totalInterest: 0 };
  })();
  const show = (key: keyof FormFieldSettings) => !fieldSettings || fieldSettings[key];

  // Force installment off when debit + terminal
  useEffect(() => {
    if (watchPaymentMethodMain === "Cartão de Débito" && watchCardTerminalId && watchInstallment) {
      form.setValue("is_installment", false);
    }
  }, [watchPaymentMethodMain, watchCardTerminalId, watchInstallment, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        {/* Status */}
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

        {/* Descrição */}
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

        {/* Fornecedor/Cliente */}
        {(show("supplier_client") || show("contact_name")) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {show("supplier_client") && (activeTab === "despesa" ? (
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <FormControl>
                    <ContactSelectWithCreate
                      contacts={suppliers}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione"
                      type="supplier"
                      onContactCreated={(id) => field.onChange(id)}
                    />
                  </FormControl>
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
                  <FormControl>
                    <ContactSelectWithCreate
                      contacts={clients}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione"
                      type="client"
                      onContactCreated={(id) => field.onChange(id)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          {show("contact_name") && (
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
          )}
        </div>
        )}

        {/* Dates: Competência → Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      onSelect={(date) => {
                        field.onChange(date);
                        paymentDateManuallyEdited.current = true;
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Valor Bruto */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Bruto (R$) *</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0,00"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">Este valor será considerado como faturamento</p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category cascade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria *</FormLabel>
                <FormControl>
                  <CategorySelectWithCreate
                    categories={rootCategories}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      form.setValue("subcategory", "");
                      form.setValue("subcategory2", "");
                    }}
                    placeholder="Selecione"
                    formCompanyId={formCompanyId}
                    activeTab={activeTab}
                    onCategoryCreated={async (newId) => {
                      await onCategoryCreated();
                      field.onChange(newId);
                      form.setValue("subcategory", "");
                      form.setValue("subcategory2", "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {show("subcategories") && form.watch("category") && (
            <FormField
              control={form.control}
              name="subcategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategoria</FormLabel>
                  <FormControl>
                    <CategorySelectWithCreate
                      categories={subCategories}
                      value={field.value || ""}
                      onChange={(v) => {
                        field.onChange(v);
                        form.setValue("subcategory2", "");
                      }}
                      placeholder="Selecione"
                      parentId={form.watch("category")}
                      formCompanyId={formCompanyId}
                      activeTab={activeTab}
                      onCategoryCreated={async (newId) => {
                        await onCategoryCreated();
                        field.onChange(newId);
                        form.setValue("subcategory2", "");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {show("subcategories") && form.watch("subcategory") && (
            <FormField
              control={form.control}
              name="subcategory2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-subcategoria</FormLabel>
                  <FormControl>
                    <CategorySelectWithCreate
                      categories={subSubCategories}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione"
                      parentId={form.watch("subcategory")}
                      formCompanyId={formCompanyId}
                      activeTab={activeTab}
                      onCategoryCreated={async (newId) => {
                        await onCategoryCreated();
                        field.onChange(newId);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Forma de pagamento */}
        {show("payment_method") && (
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
        )}

        {/* Conta/Maquininha */}
        {show("account_fields") && (
        <PaymentMethodFields
          form={form}
          activeTab={activeTab}
          paymentMethod={watchPaymentMethod}
          bankAccounts={bankAccounts}
          creditCards={creditCards}
          wallets={wallets}
           cardTerminals={cardTerminals}
        />
        )}

        {/* Installments / Recurring */}
        {(show("installments") || show("recurring")) && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            {show("installments") && (
            <div className="space-y-3">
              {/* Hide installment toggle for debit with terminal */}
              {!(watchPaymentMethodMain === "Cartão de Débito" && watchCardTerminalId) && (
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
              )}
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
                  <FormField
                    control={form.control}
                    name="installment_interval_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intervalo entre parcelas</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "monthly"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="custom_days">A cada X dias</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("installment_interval_type") === "custom_days" && (
                    <FormField
                      control={form.control}
                      name="installment_custom_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervalo em dias</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={365} placeholder="Ex: 15" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {!form.watch("card_terminal_id") && (
                    <FormField
                      control={form.control}
                      name="interest_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taxa de juros mensal (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="Ex: 1.99"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {interestPreview && watchPaymentDate && (
                    <InstallmentPreviewTable
                      totalAmount={terminalPreview ? terminalPreview.netTotal : watchAmount}
                      installmentsCount={watchInstallmentsCount}
                      paymentDate={
                        terminalPreview?.autoAnticipation
                          ? addBusinessDays(watchPaymentDate instanceof Date ? watchPaymentDate : new Date(watchPaymentDate), terminalPreview.settlementDays)
                          : addBusinessDays(addDays(watchPaymentDate instanceof Date ? watchPaymentDate : new Date(watchPaymentDate), 30), terminalPreview?.settlementDays ?? 0)
                      }
                      intervalType={terminalPreview ? "custom_days" : ((watchIntervalType as "monthly" | "custom_days") || "monthly")}
                      customDays={terminalPreview ? (terminalPreview.autoAnticipation ? 0 : 30) : (watchCustomDays ? Number(watchCustomDays) : undefined)}
                      interestRate={terminalPreview ? 0 : (watchInterestRate || 0)}
                      customAmounts={customInstallmentAmounts}
                      onCustomAmountsChange={onCustomInstallmentAmountsChange}
                      customDates={customInstallmentDates}
                      onCustomDatesChange={onCustomInstallmentDatesChange}
                      onUpdateTotalAmount={terminalPreview ? undefined : ((newTotal) => form.setValue("amount", newTotal))}
                    />
                  )}
                  {/* Series installment table for editing existing series */}
                  {isEditing && editTransaction?.series_id && (editTransaction?.installments_total ?? 0) > 1 && (
                    <SeriesInstallmentTable
                      seriesId={editTransaction.series_id}
                      onAmountsChanged={onSeriesUpdatesChange}
                    />
                  )}
                </div>
              )}
            </div>
            )}

            {/* Single-payment terminal summary (debit or credit à vista) */}
            {terminalPreview && terminalPreview.isSinglePayment && watchAmount > 0 && watchPaymentDate && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {terminalPreview.isDebit ? "Débito" : "Crédito à vista"} via maquininha
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                  <span className="text-muted-foreground">Taxa MDR:</span>
                  <span>{terminalPreview.rate.toFixed(2)}%</span>
                  <span className="text-muted-foreground">Valor líquido:</span>
                  <span className="font-semibold text-primary">
                    {terminalPreview.netTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="text-muted-foreground">Recebimento:</span>
                  <span>
                    D+{terminalPreview.settlementDays} ({format(
                      terminalPreview.isDebit
                        ? addBusinessDays(watchPaymentDate instanceof Date ? watchPaymentDate : new Date(watchPaymentDate), terminalPreview.settlementDays)
                        : addDays(watchPaymentDate instanceof Date ? watchPaymentDate : new Date(watchPaymentDate), terminalPreview.settlementDays),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )})
                  </span>
                </div>
              </div>
            )}

            {show("recurring") && !watchInstallment && (
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
                    {form.watch("recurring_frequency") === "custom_days" && (
                      <FormField
                        control={form.control}
                        name="recurring_custom_days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intervalo em dias</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={365} placeholder="Ex: 15" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
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

        {/* Observações */}
        {show("notes") && (
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
        )}

        {(show("barcode") || show("attachment_url")) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {show("barcode") && (
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
          )}
          {show("attachment_url") && (
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

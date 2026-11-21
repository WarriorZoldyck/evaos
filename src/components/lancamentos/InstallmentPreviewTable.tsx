import { useState, useMemo, useEffect } from "react";
import { addMonths, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  AlertTriangle,
  Split,
  Plus,
  Trash2,
  Layers,
  Check,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardTerminalInfo } from "@/hooks/useTransactions";
import { MdrInfoCard } from "./MdrInfoCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FLEXIBLE_PAYMENT_METHODS,
  AVAILABLE_PAYMENT_MODALITIES,
  installmentSplitsRemaining,
  validateInstallmentSplits,
  type InstallmentSplitPart,
} from "@/lib/installmentPaymentSplits";

interface AccountOption {
  id: string;
  name: string;
}

interface ModalitySetting {
  method: string;
  amount: number;
  installments: number;
  account: string;
  /** 1º vencimento desta modalidade (padrão: data do lançamento). */
  firstDate?: Date;
  /** 0 = mensal; >0 = a cada X dias. */
  intervalDays?: number;
}

interface InstallmentPreviewTableProps {
  /** Título usado no resumo para download (ex.: descrição do lançamento). */
  summaryTitle?: string;
  totalAmount: number;
  installmentsCount: number;
  paymentDate: Date;
  intervalType: "monthly" | "custom_days";
  customDays?: number;
  interestRate: number;
  customAmounts: Record<number, number>;
  onCustomAmountsChange: (amounts: Record<number, number>) => void;
  customDates?: Record<number, Date>;
  onCustomDatesChange?: (dates: Record<number, Date>) => void;
  onUpdateTotalAmount?: (newTotal: number) => void;
  flexiblePaymentEnabled?: boolean;
  onFlexiblePaymentEnabledChange?: (enabled: boolean) => void;
  customPayments?: Record<number, InstallmentSplitPart[]>;
  onCustomPaymentsChange?: (payments: Record<number, InstallmentSplitPart[]>) => void;
  customStatuses?: Record<number, "Pendente" | "Pago">;
  onCustomStatusesChange?: (statuses: Record<number, "Pendente" | "Pago">) => void;
  mainStatus?: "Pendente" | "Pago";
  onInstallmentsCountChange?: (count: number) => void;
  bankAccounts?: AccountOption[];
  wallets?: AccountOption[];
  creditCards?: AccountOption[];
  defaultMethod?: string;
  defaultAccount?: string;
  /** Avisa o formulário quais modalidades foram escolhidas. */
  onModalitiesChange?: (methods: string[]) => void;
  paymentFields?: React.ReactNode;
  showInstallmentRows?: boolean;
  cardTerminals?: CardTerminalInfo[];
}

export function InstallmentPreviewTable({
  totalAmount,
  installmentsCount,
  paymentDate,
  intervalType,
  customDays,
  interestRate,
  customAmounts,
  onCustomAmountsChange,
  customDates = {},
  onCustomDatesChange,
  onUpdateTotalAmount,
  flexiblePaymentEnabled = true,
  onFlexiblePaymentEnabledChange,
  customPayments = {},
  onCustomPaymentsChange,
  customStatuses = {},
  onCustomStatusesChange,
  mainStatus = "Pendente",
  onInstallmentsCountChange,
  bankAccounts = [],
  wallets = [],
  creditCards = [],
  defaultMethod = "",
  defaultAccount = "",
  onModalitiesChange,
  paymentFields,
  showInstallmentRows = true,
  cardTerminals = [],
  summaryTitle = "",
}: InstallmentPreviewTableProps) {
  const isCardMethod = (m: string) => m === "Cartão de Crédito" || m === "Cartão de Débito";
  const [distribute, setDistribute] = useState(true);

  // Modalidades selecionadas para o parcelado (ex: [PIX, Cartão de Crédito])
  const [selectedModalities, setSelectedModalities] = useState<string[]>(
    defaultMethod ? [defaultMethod] : [],
  );

  // Configuração detalhada por modalidade
  const [modalitiesConfig, setModalitiesConfig] = useState<Record<string, ModalitySetting>>(
    defaultMethod
      ? {
          [defaultMethod]: {
            method: defaultMethod,
            amount: totalAmount,
            installments: Math.max(1, installmentsCount || 2),
            account: defaultAccount || "",
          },
        }
      : {},
  );

  useEffect(() => {
    onModalitiesChange?.(selectedModalities);
  }, [selectedModalities]);

  // Mantém modalidades sincronizadas se defaultMethod mudar no formulário principal
  useEffect(() => {
    if (defaultMethod && !selectedModalities.includes(defaultMethod)) {
      setSelectedModalities((prev) => {
        if (prev.length <= 1) return [defaultMethod];
        return prev;
      });
    }
  }, [defaultMethod]);

  const hasInterest = interestRate > 0;
  const n = installmentsCount;

  // Cálculo das parcelas
  const installments = useMemo(() => {
    const result: { number: number; date: Date; amount: number }[] = [];

    if (hasInterest) {
      const i = interestRate / 100;
      const pmt =
        Math.round(
          totalAmount *
            ((i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)) *
            100
        ) / 100;

      for (let idx = 0; idx < n; idx++) {
        const defaultDate =
          intervalType === "custom_days" && customDays
            ? addDays(paymentDate, idx * customDays)
            : addMonths(paymentDate, idx);
        const date = customDates[idx + 1] ?? defaultDate;
        result.push({ number: idx + 1, date, amount: pmt });
      }
    } else {
      const defaultPmt = Math.round((totalAmount / n) * 100) / 100;
      const editedIndices = Object.keys(customAmounts).map(Number);
      const hasEdits = editedIndices.length > 0;

      if (hasEdits && distribute) {
        const customSum = editedIndices.reduce((sum, idx) => sum + (customAmounts[idx] || 0), 0);
        const remaining = totalAmount - customSum;
        const nonEditedCount = n - editedIndices.length;
        const otherAmount = nonEditedCount > 0 ? Math.round((remaining / nonEditedCount) * 100) / 100 : 0;

        for (let idx = 0; idx < n; idx++) {
          const defaultDate =
            intervalType === "custom_days" && customDays
              ? addDays(paymentDate, idx * customDays)
              : addMonths(paymentDate, idx);
          const date = customDates[idx + 1] ?? defaultDate;
          const instNum = idx + 1;
          const amount = customAmounts[instNum] !== undefined ? customAmounts[instNum] : otherAmount;
          result.push({ number: instNum, date, amount });
        }
      } else {
        for (let idx = 0; idx < n; idx++) {
          const defaultDate =
            intervalType === "custom_days" && customDays
              ? addDays(paymentDate, idx * customDays)
              : addMonths(paymentDate, idx);
          const date = customDates[idx + 1] ?? defaultDate;
          const instNum = idx + 1;
          const amount = customAmounts[instNum] !== undefined ? customAmounts[instNum] : defaultPmt;
          result.push({ number: instNum, date, amount });
        }
      }
    }

    return result;
  }, [totalAmount, n, paymentDate, intervalType, customDays, interestRate, hasInterest, customAmounts, distribute, customDates]);

  // Uma única modalidade: todas as parcelas recebem essa forma (e a conta escolhida).
  useEffect(() => {
    if (!showInstallmentRows || selectedModalities.length !== 1 || !onCustomPaymentsChange) return;
    const m = selectedModalities[0];
    const acc = modalitiesConfig[m]?.account || "";
    const next: Record<number, InstallmentSplitPart[]> = {};
    let changed = false;
    for (const inst of installments) {
      const cur = customPayments[inst.number];
      if (cur && cur.length > 1) { next[inst.number] = cur; continue; }
      if (cur && cur.length === 1 && cur[0].method === m && Math.abs(cur[0].amount - inst.amount) < 0.005 && (cur[0].account || !acc)) {
        next[inst.number] = cur;
      } else {
        changed = true;
        next[inst.number] = [{ method: m, account: cur?.[0]?.method === m && cur[0].account ? cur[0].account : acc, amount: inst.amount, status: getInstallmentStatus(inst.number) }];
      }
    }
    if (Object.keys(customPayments).length !== installments.length) changed = true;
    if (changed) {
      onCustomPaymentsChange(next);
      if (onFlexiblePaymentEnabledChange && !flexiblePaymentEnabled) onFlexiblePaymentEnabledChange(true);
    }
  }, [selectedModalities, installments, modalitiesConfig, showInstallmentRows]);

  const total = useMemo(
    () => installments.reduce((sum, inst) => sum + inst.amount, 0),
    [installments]
  );

  const totalInterest = hasInterest ? Math.round((total - totalAmount) * 100) / 100 : 0;
  const hasEdits = Object.keys(customAmounts).length > 0;
  const exceeds = !hasInterest && total > totalAmount + 0.01;

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const handleAmountChange = (instNumber: number, value: string) => {
    const val = parseFloat(value);
    if (isNaN(val) || val === 0) {
      const next = { ...customAmounts };
      delete next[instNumber];
      onCustomAmountsChange(next);
    } else {
      onCustomAmountsChange({ ...customAmounts, [instNumber]: val });
    }
  };

  const handleDateChange = (instNumber: number, date: Date | undefined) => {
    if (!onCustomDatesChange || !date) return;
    onCustomDatesChange({ ...customDates, [instNumber]: date });
  };

  // Status de cada parcela:
  // Parcela 1 herda o status do formulário (ex: "Pago" se foi Pix ou pago na hora)
  // Parcela 2, 3... DEVEM vir como "Pendente" por padrão!
  const getInstallmentStatus = (instNumber: number): "Pendente" | "Pago" => {
    if (customStatuses[instNumber]) {
      return customStatuses[instNumber];
    }
    return instNumber === 1 ? (mainStatus || "Pendente") : "Pendente";
  };

  const handleStatusChange = (instNumber: number, newStatus: "Pendente" | "Pago") => {
    if (!onCustomStatusesChange) return;
    onCustomStatusesChange({
      ...customStatuses,
      [instNumber]: newStatus,
    });
  };

  const getParts = (instNumber: number, instAmount: number): InstallmentSplitPart[] => {
    const existing = customPayments[instNumber];
    if (existing && existing.length > 0) return existing;
    return [{
      method: defaultMethod || selectedModalities[0] || "",
      account: defaultAccount || "",
      amount: instAmount,
      status: getInstallmentStatus(instNumber),
    }];
  };

  const setParts = (instNumber: number, parts: InstallmentSplitPart[]) => {
    if (!onCustomPaymentsChange) return;
    onCustomPaymentsChange({ ...customPayments, [instNumber]: parts });
  };

  const updatePart = (
    instNumber: number,
    instAmount: number,
    partIdx: number,
    patch: Partial<InstallmentSplitPart>
  ) => {
    const current = getParts(instNumber, instAmount);
    const next = current.map((p, idx) => (idx === partIdx ? { ...p, ...patch } : p));
    if (patch.account !== undefined && onCustomPaymentsChange) {
      // Mesma modalidade nas outras parcelas recebe a mesma conta (só onde ainda está vazia)
      const method = next[partIdx].method;
      const all: Record<number, InstallmentSplitPart[]> = { ...customPayments, [instNumber]: next };
      for (const k of Object.keys(all)) {
        const num = Number(k);
        if (num === instNumber) continue;
        all[num] = all[num].map((p) => (p.method === method && !p.account ? { ...p, account: patch.account ?? "" } : p));
      }
      onCustomPaymentsChange(all);
      if (modalitiesConfig[method]) {
        setModalitiesConfig((c) => ({ ...c, [method]: { ...c[method], account: patch.account ?? "" } }));
      }
      return;
    }
    setParts(instNumber, next);
  };

  const addSplitPart = (instNumber: number, instAmount: number) => {
    const current = getParts(instNumber, instAmount);
    const rem = Math.max(0, installmentSplitsRemaining(instAmount, current));
    setParts(instNumber, [
      ...current,
      { method: defaultMethod || selectedModalities[0] || "", account: defaultAccount || "", amount: rem, status: getInstallmentStatus(instNumber) },
    ]);
  };

  const removeSplitPart = (instNumber: number, instAmount: number, partIdx: number) => {
    const current = getParts(instNumber, instAmount);
    if (current.length <= 1) return;
    setParts(
      instNumber,
      current.filter((_, idx) => idx !== partIdx)
    );
  };

  // Alterna uma modalidade nos chips superiores
  const handleToggleModality = (methodName: string) => {
    let nextMethods: string[];
    if (selectedModalities.includes(methodName)) {
      nextMethods = selectedModalities.filter((m) => m !== methodName);
    } else {
      nextMethods = [...selectedModalities, methodName];
    }
    setSelectedModalities(nextMethods);
    onModalitiesChange?.(nextMethods);

    // Inicializa configuração da nova modalidade se necessário
    const nextConfig = { ...modalitiesConfig };
    if (!nextConfig[methodName]) {
      // Divide valor restante igualmente
      const currentSum = Object.entries(nextConfig)
        .filter(([k]) => nextMethods.includes(k) && k !== methodName)
        .reduce((sum, [, cfg]) => sum + (cfg.amount || 0), 0);
      const remaining = Math.max(0, Math.round((totalAmount - currentSum) * 100) / 100);

      nextConfig[methodName] = {
        method: methodName,
        amount: remaining,
        installments: methodName === "PIX" || methodName === "Dinheiro" ? 1 : 2,
        account: defaultAccount || "",
      };
    }
    setModalitiesConfig(nextConfig);

    // Ativa automaticamente o modo flexível
    if (onFlexiblePaymentEnabledChange && !flexiblePaymentEnabled) {
      onFlexiblePaymentEnabledChange(true);
    }

    // Se houver mais de uma modalidade, aplica a geração baseada nas modalidades
    if (nextMethods.length > 1) {
      applyModalitiesToInstallments(nextMethods, nextConfig);
    }
  };

  // Atualiza campo de uma modalidade específica
  const handleUpdateModalityConfig = (
    methodName: string,
    patch: Partial<ModalitySetting>
  ) => {
    const nextConfig = {
      ...modalitiesConfig,
      [methodName]: {
        ...modalitiesConfig[methodName],
        ...patch,
      },
    };
    setModalitiesConfig(nextConfig);
    applyModalitiesToInstallments(selectedModalities, nextConfig);
  };

  // Distribui as modalidades gerando as parcelas consolidadas
  const applyModalitiesToInstallments = (
    methods: string[],
    configs: Record<string, ModalitySetting>
  ) => {
    let currentInstIndex = 1;
    const nextAmounts: Record<number, number> = {};
    const nextPayments: Record<number, InstallmentSplitPart[]> = {};
    const nextStatuses: Record<number, "Pendente" | "Pago"> = {};
    const nextDates: Record<number, Date> = {};

    let totalCount = 0;
    methods.forEach((m) => {
      const cfg = configs[m] || {
        method: m,
        amount: totalAmount / methods.length,
        installments: 1,
        account: "",
      };
      const count = Math.max(1, cfg.installments || 1);
      totalCount += count;
      const pmt = Math.round((cfg.amount / count) * 100) / 100;

      for (let i = 0; i < count; i++) {
        const instNum = currentInstIndex;
        // Ajusta arredondamento na última parcela desta modalidade
        const isLastInModality = i === count - 1;
        const instAmount = isLastInModality
          ? Math.round((cfg.amount - pmt * (count - 1)) * 100) / 100
          : pmt;

        nextAmounts[instNum] = Math.max(0, instAmount);

        // Status: 1ª parcela herda o status do formulário (ex: "Pago" se foi Pix ou pago na hora),
        // enquanto as parcelas 2 em diante são sempre "Pendente" por padrão!
        const status: "Pendente" | "Pago" =
          instNum === 1 ? (mainStatus || "Pendente") : "Pendente";

        nextStatuses[instNum] = status;

        nextPayments[instNum] = [
          {
            method: cfg.method,
            account: isCardMethod(cfg.method)
              ? (cfg.account?.startsWith("terminal:") ? cfg.account : "")
              : (cfg.account || defaultAccount || ""),
            amount: instAmount,
            status,
          },
        ];

        // Vencimentos da modalidade: 1º vencimento + intervalo próprio
        const base = cfg.firstDate ?? paymentDate;
        nextDates[instNum] = cfg.intervalDays && cfg.intervalDays > 0
          ? addDays(base, i * cfg.intervalDays)
          : addMonths(base, i);

        currentInstIndex++;
      }
    });

    if (onInstallmentsCountChange && totalCount >= 2) {
      onInstallmentsCountChange(totalCount);
    }
    onCustomAmountsChange(nextAmounts);
    if (onCustomPaymentsChange) onCustomPaymentsChange(nextPayments);
    if (onCustomStatusesChange) onCustomStatusesChange(nextStatuses);
    if (onCustomDatesChange) onCustomDatesChange(nextDates);
  };

  const modalitiesSum = useMemo(() => {
    return selectedModalities.reduce(
      (sum, m) => sum + (modalitiesConfig[m]?.amount || 0),
      0
    );
  }, [selectedModalities, modalitiesConfig]);

  const modalitiesDiff = Math.round((totalAmount - modalitiesSum) * 100) / 100;

  // Faixa de parcelas (numeração global) que pertence a cada modalidade
  const modalityRanges = useMemo(() => {
    const r: Record<string, number[]> = {};
    let idx = 1;
    for (const m of selectedModalities) {
      const c = Math.max(1, modalitiesConfig[m]?.installments || 1);
      r[m] = Array.from({ length: c }, (_, k) => idx + k);
      idx += c;
    }
    return r;
  }, [selectedModalities, modalitiesConfig]);

  // Edita o valor de uma parcela dentro da modalidade e redistribui nas seguintes
  const handleModalityInstAmount = (mName: string, instNum: number, raw: string) => {
    const val = Math.max(0, parseFloat(raw) || 0);
    const range = modalityRanges[mName] || [];
    const cfg = modalitiesConfig[mName];
    if (!cfg) return;
    const pos = range.indexOf(instNum);
    const nextAmounts = { ...customAmounts, [instNum]: val };
    const later = range.slice(pos + 1);
    if (distribute && later.length > 0) {
      const used = range.slice(0, pos + 1).reduce((s2, k) => s2 + (k === instNum ? val : (customAmounts[k] ?? 0)), 0);
      const rest = Math.max(0, cfg.amount - used);
      const each = Math.round((rest / later.length) * 100) / 100;
      later.forEach((k, j) => {
        nextAmounts[k] = j === later.length - 1 ? Math.round((rest - each * (later.length - 1)) * 100) / 100 : each;
      });
    }
    onCustomAmountsChange(nextAmounts);
    if (onCustomPaymentsChange) {
      const np = { ...customPayments };
      for (const k of range) {
        if (np[k]?.length === 1) np[k] = [{ ...np[k][0], amount: nextAmounts[k] ?? np[k][0].amount }];
      }
      onCustomPaymentsChange(np);
    }
  };

  const accountLabel = (acc: string | undefined) => {
    if (!acc) return "—";
    const [kind, id] = [acc.slice(0, acc.indexOf(":")), acc.slice(acc.indexOf(":") + 1)];
    if (kind === "terminal") return `Maquininha ${cardTerminals.find((t) => t.id === id)?.name ?? ""}`;
    if (kind === "bank") return bankAccounts.find((a) => a.id === id)?.name ?? "—";
    if (kind === "wallet") return wallets.find((a) => a.id === id)?.name ?? "—";
    if (kind === "card") return creditCards.find((a) => a.id === id)?.name ?? "—";
    return "—";
  };

  const accountOptionsFor = (m: string) => (
    m === "Dinheiro"
      ? [...wallets.map((w) => ({ v: `wallet:${w.id}`, l: `👛 ${w.name}` })), ...bankAccounts.map((a) => ({ v: `bank:${a.id}`, l: `🏦 ${a.name}` }))]
      : [...bankAccounts.map((a) => ({ v: `bank:${a.id}`, l: `🏦 ${a.name}` })), ...wallets.map((w) => ({ v: `wallet:${w.id}`, l: `👛 ${w.name}` }))]
  );

  const renderAccountSelect = (mName: string, cfg: ModalitySetting) => {
    const opts = accountOptionsFor(mName);
    return (
      <div className="space-y-1 pt-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {mName === "Dinheiro" ? "Carteira" : "Conta bancária (onde cai)"}
        </Label>
        <Select
          value={cfg.account && !cfg.account.startsWith("terminal:") ? cfg.account : undefined}
          onValueChange={(v) => {
            handleUpdateModalityConfig(mName, { account: v });
            if (selectedModalities.length === 1 && onCustomPaymentsChange) {
              const np: Record<number, InstallmentSplitPart[]> = {};
              for (const k of Object.keys(customPayments)) np[Number(k)] = customPayments[Number(k)].map((p) => p.method === mName ? { ...p, account: v } : p);
              onCustomPaymentsChange(np);
            }
          }}
        >
          <SelectTrigger className={cn("h-7 text-xs", !cfg.account && "border-destructive")} aria-label={`Conta de ${mName}`}>
            <SelectValue placeholder={mName === "Dinheiro" ? "Escolha a carteira" : "Escolha a conta"} />
          </SelectTrigger>
          <SelectContent>
            {opts.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cadastre em Contas</div>}
            {opts.map((o) => <SelectItem key={o.v} value={o.v} className="text-xs">{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const downloadSummary = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Resumo de pagamento", 14, 18);
    doc.setFontSize(10);
    let y = 26;
    if (summaryTitle) { doc.text(summaryTitle, 14, y); y += 6; }
    doc.text(`Valor total: R$ ${formatCurrency(total)}`, 14, y); y += 6;
    const cond = selectedModalities.map((m) => {
      const c = modalitiesConfig[m];
      return c ? `${m}: R$ ${formatCurrency(c.amount)} em ${c.installments}x` : m;
    }).join("  |  ");
    if (cond) { doc.text(doc.splitTextToSize(`Condição: ${cond}`, 180), 14, y); y += 8; }
    const rows = [...installments].sort((a, b) => a.date.getTime() - b.date.getTime()).map((inst, i) => {
      const parts = getParts(inst.number, inst.amount);
      return [String(i + 1), format(inst.date, "dd/MM/yyyy"), parts.map((p) => p.method).join(" + "), `R$ ${formatCurrency(inst.amount)}`];
    });
    autoTable(doc, { startY: y + 2, head: [["#", "Vencimento", "Forma", "Valor"]], body: rows,
      foot: [["", "", "Total", `R$ ${formatCurrency(total)}`]], styles: { fontSize: 9 } });
    doc.setFontSize(8);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy")}`, 14, 288);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orcamento-${(summaryTitle || "parcelas").toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO 1: PERGUNTA DE MODALIDADES DE PAGAMENTO (1 ou Múltiplas) */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Modalidades de Pagamento no Parcelamento
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Selecione quais formas compõem este lançamento (ex: Entrada no Pix + Cartão ou Boleto):
            </p>
          </div>
          {selectedModalities.length > 1 && (
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 w-fit",
                modalitiesDiff === 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              )}
            >
              {modalitiesDiff === 0
                ? "✓ Soma das modalidades fechada"
                : modalitiesDiff > 0
                ? `Faltam R$ ${formatCurrency(modalitiesDiff)}`
                : `Excede R$ ${formatCurrency(Math.abs(modalitiesDiff))}`}
            </span>
          )}
        </div>

        {/* Chips de seleção de modalidades */}
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_PAYMENT_MODALITIES.map((mod) => {
            const isSelected = selectedModalities.includes(mod.id);
            return (
              <Button
                key={mod.id}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "h-7 text-xs px-2.5 gap-1.5 transition-all",
                  isSelected
                    ? "shadow-sm font-medium"
                    : "bg-background/80 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleToggleModality(mod.id)}
              >
                <span>{mod.icon}</span>
                <span>{mod.label}</span>
                {isSelected && <Check className="h-3 w-3 ml-0.5" />}
              </Button>
            );
          })}
        </div>

        {selectedModalities.length === 1 && showInstallmentRows && !isCardMethod(selectedModalities[0]) && (
          <div className="pt-2 border-t border-border/60 max-w-sm">
            {renderAccountSelect(selectedModalities[0], modalitiesConfig[selectedModalities[0]] || { method: selectedModalities[0], amount: totalAmount, installments: n, account: "" })}
          </div>
        )}

        {/* Detalhamento quando houver 2+ modalidades selecionadas */}
        {selectedModalities.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedModalities.map((mName) => {
                const cfg = modalitiesConfig[mName] || {
                  method: mName,
                  amount: 0,
                  installments: 1,
                  account: "",
                };
                return (
                  <div
                    key={mName}
                    className="rounded-md border border-border bg-background p-2.5 space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {AVAILABLE_PAYMENT_MODALITIES.find((x) => x.id === mName)?.icon} {mName}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleToggleModality(mName)}
                        title="Remover modalidade"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Valor (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-7 text-xs mt-0.5"
                          value={cfg.amount || ""}
                          placeholder="0,00"
                          onChange={(e) =>
                            handleUpdateModalityConfig(mName, {
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Em quantas vezes?
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          className="h-7 text-xs mt-0.5"
                          value={cfg.installments || 1}
                          onChange={(e) =>
                            handleUpdateModalityConfig(mName, {
                              installments: parseInt(e.target.value, 10) || 1,
                            })
                          }
                        />
                      </div>
                    </div>
                    {isCardMethod(mName) && cardTerminals.length > 0 && (() => {
                      const tid = cfg.account?.startsWith("terminal:") ? cfg.account.slice(9) : "";
                      const term = cardTerminals.find((t) => t.id === tid);
                      return (
                        <div className="space-y-1.5 pt-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Maquininha
                          </Label>
                          <Select
                            value={tid || undefined}
                            onValueChange={(v) => handleUpdateModalityConfig(mName, { account: `terminal:${v}` })}
                          >
                            <SelectTrigger className={cn("h-7 text-xs", !tid && "border-destructive")}>
                              <SelectValue placeholder="Escolha a maquininha" />
                            </SelectTrigger>
                            <SelectContent>
                              {cardTerminals.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {term && cfg.amount > 0 && (
                            <MdrInfoCard
                              terminal={term}
                              amount={cfg.amount}
                              paymentMethod={mName}
                              installmentsCount={cfg.installments || 1}
                              paymentDate={paymentDate}
                            />
                          )}
                        </div>
                      );
                    })()}
                    {!isCardMethod(mName) && renderAccountSelect(mName, cfg)}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">1º vencimento</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="h-7 w-full justify-start px-2 text-xs font-normal mt-0.5">
                              <CalendarIcon className="mr-1.5 h-3 w-3 opacity-60" />
                              {format(cfg.firstDate ?? paymentDate, "dd/MM/yyyy", { locale: ptBR })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={cfg.firstDate ?? paymentDate}
                              onSelect={(d) => d && handleUpdateModalityConfig(mName, { firstDate: d })}
                              locale={ptBR} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Intervalo</Label>
                        <Select value={String(cfg.intervalDays || 0)}
                          onValueChange={(v) => handleUpdateModalityConfig(mName, { intervalDays: Number(v) })}>
                          <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" className="text-xs">Mensal</SelectItem>
                            {[7, 10, 14, 15, 21, 28, 30, 45, 60].map((d) => (
                              <SelectItem key={d} value={String(d)} className="text-xs">A cada {d} dias</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(modalityRanges[mName]?.length ?? 0) > 0 && (
                      <div className="space-y-1 pt-1.5 border-t border-border/50">
                        {modalityRanges[mName].map((k, j) => {
                          const inst = installments.find((x) => x.number === k);
                          if (!inst) return null;
                          return (
                            <div key={k} className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground w-8 shrink-0">{j + 1}/{modalityRanges[mName].length}</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button type="button" variant="outline" className="h-6 px-2 text-[11px] font-normal">
                                    {format(inst.date, "dd/MM/yyyy", { locale: ptBR })}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={inst.date} onSelect={(d) => handleDateChange(k, d)}
                                    locale={ptBR} className="p-3 pointer-events-auto" />
                                </PopoverContent>
                              </Popover>
                              <Input type="number" step="0.01" min="0" className="h-6 flex-1 text-[11px] text-right"
                                value={inst.amount} onChange={(e) => handleModalityInstAmount(mName, k, e.target.value)} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {paymentFields}

      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO 2: LISTA DE PARCELAS (SESSÃO DE LANÇAMENTO EM CADA UMA) */}
      {/* ------------------------------------------------------------- */}
      {showInstallmentRows && <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Resumo das Parcelas ({installments.length})
          </Label>
          <span className="text-[11px] text-muted-foreground">
            A 1ª parcela herda o status inicial; as demais vêm como pendentes
          </span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-[11px] w-10">#</TableHead>
                  <TableHead className="h-8 text-[11px]">Vencimento</TableHead>
                  <TableHead className="h-8 text-[11px]">Forma</TableHead>
                  <TableHead className="h-8 text-[11px]">Conta / Maquininha</TableHead>
                  <TableHead className="h-8 text-[11px]">Status</TableHead>
                  <TableHead className="h-8 text-[11px] text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...installments].sort((x, y) => x.date.getTime() - y.date.getTime()).map((inst, i) => {
                  const parts = getParts(inst.number, inst.amount);
                  const st = getInstallmentStatus(inst.number);
                  return (
                    <TableRow key={inst.number}>
                      <TableCell className="py-1.5 text-xs">{i + 1}</TableCell>
                      <TableCell className="py-1.5 text-xs">{format(inst.date, "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="py-1.5 text-xs">{parts.map((p) => p.method || "—").join(" + ")}</TableCell>
                      <TableCell className={cn("py-1.5 text-xs", parts.some((p) => !p.account) && "text-destructive")}>
                        {parts.map((p) => p.account ? accountLabel(p.account) : (isCardMethod(p.method) ? "Falta maquininha" : "Falta conta")).join(" + ")}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", st === "Pago" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{st}</span>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-semibold">R$ {formatCurrency(inst.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Resumo apenas para conferência — edite nos quadros acima.</span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={downloadSummary}>
            Baixar resumo (PDF)
          </Button>
        </div>

        {/* Total consolidado */}
        <div className="rounded-md border border-border bg-muted/40 p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            <span>Total das {installments.length} parcelas</span>
            {totalInterest > 0 && (
              <span className="text-muted-foreground font-normal">
                (juros: R$ {formatCurrency(totalInterest)})
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="font-bold text-sm text-foreground">
              R$ {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>}

      {/* Alerta de divergência de valor */}
      {showInstallmentRows && exceeds && onUpdateTotalAmount && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>
              Total das parcelas (R$ {formatCurrency(total)}) difere do valor bruto (R$ {formatCurrency(totalAmount)}).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => onUpdateTotalAmount(Math.round(total * 100) / 100)}
            >
              Atualizar valor bruto
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Opção de redistribuição */}
      {showInstallmentRows && !hasInterest && hasEdits && (
        <div className="flex items-center gap-2 pt-0.5">
          <Checkbox
            id="distribute-diff"
            checked={distribute}
            onCheckedChange={(checked) => setDistribute(!!checked)}
          />
          <Label htmlFor="distribute-diff" className="text-xs text-muted-foreground cursor-pointer">
            Distribuir diferença automaticamente nas demais parcelas
          </Label>
        </div>
      )}
    </div>
  );
}

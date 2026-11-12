import { useState, useMemo } from "react";
import { addMonths, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, AlertTriangle, Split, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  installmentSplitsRemaining,
  validateInstallmentSplits,
  type InstallmentSplitPart,
} from "@/lib/installmentPaymentSplits";

interface AccountOption {
  id: string;
  name: string;
}

interface InstallmentPreviewTableProps {
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
  bankAccounts?: AccountOption[];
  wallets?: AccountOption[];
  creditCards?: AccountOption[];
  defaultMethod?: string;
  defaultAccount?: string;
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
  flexiblePaymentEnabled = false,
  onFlexiblePaymentEnabledChange,
  customPayments = {},
  onCustomPaymentsChange,
  bankAccounts = [],
  wallets = [],
  creditCards = [],
  defaultMethod = "",
  defaultAccount = "",
}: InstallmentPreviewTableProps) {
  const [distribute, setDistribute] = useState(true);

  const hasInterest = interestRate > 0;
  const n = installmentsCount;

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

  const getParts = (instNumber: number, instAmount: number): InstallmentSplitPart[] => {
    const existing = customPayments[instNumber];
    if (existing && existing.length > 0) return existing;
    return [{ method: defaultMethod || "PIX", account: defaultAccount || "", amount: instAmount }];
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
    setParts(instNumber, next);
  };

  const addSplitPart = (instNumber: number, instAmount: number) => {
    const current = getParts(instNumber, instAmount);
    const rem = Math.max(0, installmentSplitsRemaining(instAmount, current));
    setParts(instNumber, [...current, { method: "", account: "", amount: rem }]);
  };

  const removeSplitPart = (instNumber: number, instAmount: number, partIdx: number) => {
    const current = getParts(instNumber, instAmount);
    if (current.length <= 1) return;
    setParts(
      instNumber,
      current.filter((_, idx) => idx !== partIdx)
    );
  };

  return (
    <div className="space-y-2">
      {onFlexiblePaymentEnabledChange && onCustomPaymentsChange && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="flexible-payment-mode"
              checked={flexiblePaymentEnabled}
              onCheckedChange={(checked) => onFlexiblePaymentEnabledChange(!!checked)}
            />
            <Label htmlFor="flexible-payment-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
              <Split className="h-3.5 w-3.5 text-primary" />
              Pagamento flexível / misto por parcela
            </Label>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Permite formas diferentes ou dividir a mesma parcela
          </span>
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs w-10">#</TableHead>
              <TableHead className="h-8 px-3 text-xs">Vencimento</TableHead>
              <TableHead className="h-8 px-3 text-xs text-right">
                Valor (R$)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((inst) => {
              const parts = flexiblePaymentEnabled ? getParts(inst.number, inst.amount) : [];
              const splitErr = flexiblePaymentEnabled
                ? validateInstallmentSplits(inst.amount, parts)
                : null;
              const rem = flexiblePaymentEnabled
                ? installmentSplitsRemaining(inst.amount, parts)
                : 0;

              return (
                <>
                  <TableRow key={inst.number} className="hover:bg-transparent">
                    <TableCell className="py-1.5 px-3 text-xs text-muted-foreground">
                      {inst.number}
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-xs">
                      {onCustomDatesChange ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-xs font-normal"
                            >
                              {format(inst.date, "dd/MM/yyyy", { locale: ptBR })}
                              <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={inst.date}
                              onSelect={(d) => handleDateChange(inst.number, d)}
                              locale={ptBR}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        format(inst.date, "dd/MM/yyyy", { locale: ptBR })
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-right">
                      {!hasInterest ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-7 w-28 text-xs text-right ml-auto"
                          value={inst.amount}
                          onChange={(e) => handleAmountChange(inst.number, e.target.value)}
                        />
                      ) : (
                        <span className="text-xs">
                          {formatCurrency(inst.amount)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {flexiblePaymentEnabled && (
                    <TableRow key={`${inst.number}-pay`} className="bg-muted/15 hover:bg-muted/15">
                      <TableCell colSpan={3} className="py-2 px-3">
                        <div className="space-y-1.5">
                          {parts.map((part, pIdx) => (
                            <div key={pIdx} className="flex flex-wrap items-center gap-1.5">
                              <Select
                                value={part.method}
                                onValueChange={(v) => updatePart(inst.number, inst.amount, pIdx, { method: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
                                  <SelectValue placeholder="Forma" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FLEXIBLE_PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m} value={m} className="text-xs">
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={part.account || "__none__"}
                                onValueChange={(v) =>
                                  updatePart(inst.number, inst.amount, pIdx, {
                                    account: v === "__none__" ? "" : v,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs flex-1 min-w-[140px] bg-background">
                                  <SelectValue placeholder="Conta / Cartão (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                    Sem conta vinculada
                                  </SelectItem>
                                  {creditCards.map((c) => (
                                    <SelectItem key={`card:${c.id}`} value={`card:${c.id}`} className="text-xs">
                                      💳 {c.name}
                                    </SelectItem>
                                  ))}
                                  {bankAccounts.map((a) => (
                                    <SelectItem key={`bank:${a.id}`} value={`bank:${a.id}`} className="text-xs">
                                      🏦 {a.name}
                                    </SelectItem>
                                  ))}
                                  {wallets.map((w) => (
                                    <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`} className="text-xs">
                                      👛 {w.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {parts.length > 1 && (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-7 w-24 text-xs text-right bg-background"
                                  value={part.amount}
                                  onChange={(e) =>
                                    updatePart(inst.number, inst.amount, pIdx, {
                                      amount: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              )}

                              {parts.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeSplitPart(inst.number, inst.amount, pIdx)}
                                  title="Remover parte"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}

                          <div className="flex items-center justify-between pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-primary"
                              onClick={() => addSplitPart(inst.number, inst.amount)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Dividir parcela (misto)
                            </Button>

                            {parts.length > 1 && (
                              <span
                                className={cn(
                                  "text-[11px]",
                                  splitErr ? "text-destructive font-medium" : "text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {splitErr
                                  ? rem > 0
                                    ? `Faltam R$ ${formatCurrency(rem)}`
                                    : `Excede R$ ${formatCurrency(Math.abs(rem))}`
                                  : "✓ Soma fechada"}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {/* Total row */}
            <TableRow className="border-t font-medium hover:bg-transparent">
              <TableCell className="py-1.5 px-3 text-xs" colSpan={2}>
                Total
                {totalInterest > 0 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    (juros: R$ {formatCurrency(totalInterest)})
                  </span>
                )}
              </TableCell>
              <TableCell className="py-1.5 px-3 text-xs text-right font-semibold">
                R$ {formatCurrency(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Exceed warning */}
      {exceeds && onUpdateTotalAmount && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>
              Total das parcelas (R$ {formatCurrency(total)}) excede o valor bruto (R$ {formatCurrency(totalAmount)}).
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

      {/* Distribute checkbox */}
      {!hasInterest && hasEdits && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="distribute-diff"
            checked={distribute}
            onCheckedChange={(checked) => setDistribute(!!checked)}
          />
          <Label htmlFor="distribute-diff" className="text-xs text-muted-foreground cursor-pointer">
            Distribuir diferença nas demais parcelas
          </Label>
        </div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { addBusinessDays } from "@/lib/utils";
import type { CardTerminalInfo } from "@/hooks/useTransactions";

interface RateInfo {
  installments: number;
  rate: number;
}

interface MdrInfoCardProps {
  terminal: CardTerminalInfo;
  amount: number;
  paymentMethod: string;
  installmentsCount?: number;
  paymentDate: Date;
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

export function MdrInfoCard({
  terminal,
  amount,
  paymentMethod,
  installmentsCount,
  paymentDate,
}: MdrInfoCardProps) {
  const mdrCalc = useMemo(() => {
    if (!amount || amount <= 0) return null;

    const isDebit = paymentMethod === "Cartão de Débito";
    const isCredit = paymentMethod === "Cartão de Crédito";
    if (!isDebit && !isCredit) return null;

    let rate: number;
    let settlementDays: number;

    if (isDebit) {
      rate = terminal.debit_rate ?? 0;
      settlementDays = terminal.settlement_days_debit ?? 1;
    } else {
      const fallbackRate = terminal.credit_rate ?? 0;
      if (installmentsCount && installmentsCount >= 2) {
        const rates = parseRatesInfo(terminal.rates_info);
        const match = rates.find((r) => r.installments === installmentsCount);
        rate = match ? match.rate : fallbackRate;
      } else {
        rate = fallbackRate;
      }
      settlementDays = terminal.settlement_days_credit ?? 2;
    }

    const isInstallment = isCredit && installmentsCount && installmentsCount >= 2;

    if (isInstallment) {
      // Per-installment breakdown with cent rounding on last installment
      const count = installmentsCount!;
      const grossFloor = Math.floor((amount / count) * 100) / 100;
      const grossLast = Math.round((amount - grossFloor * (count - 1)) * 100) / 100;

      let totalFee = 0;
      let totalNet = 0;
      const perInstallment: { gross: number; fee: number; net: number }[] = [];
      for (let i = 0; i < count; i++) {
        const g = i === count - 1 ? grossLast : grossFloor;
        const f = Math.round(g * (rate / 100) * 100) / 100;
        const n = Math.round((g - f) * 100) / 100;
        perInstallment.push({ gross: g, fee: f, net: n });
        totalFee += f;
        totalNet += n;
      }
      totalFee = Math.round(totalFee * 100) / 100;
      totalNet = Math.round(totalNet * 100) / 100;

      const grossPerInstallment = grossFloor;
      const feePerInstallment = perInstallment[0].fee;
      const netPerInstallment = perInstallment[0].net;

      // Generate installment dates
      const autoAnticipation = (terminal as any).auto_anticipation ?? false;
      const installmentDates: Date[] = [];
      for (let i = 0; i < count; i++) {
        if (autoAnticipation) {
          // All installments on the same D+X (business days)
          installmentDates.push(addBusinessDays(paymentDate, settlementDays));
        } else {
          // 30-day intervals + D+X business days settlement
          const vencimento = addDays(paymentDate, 30 * (i + 1));
          installmentDates.push(addBusinessDays(vencimento, settlementDays));
        }
      }

      return {
        type: "installment" as const,
        rate,
        count,
        grossPerInstallment,
        feePerInstallment,
        netPerInstallment,
        totalFee,
        totalNet,
        installmentDates,
        settlementDays,
        autoAnticipation,
      };
    } else {
      // Single transaction
      const feeAmount = Math.round(amount * (rate / 100) * 100) / 100;
      const netAmount = Math.round((amount - feeAmount) * 100) / 100;
      const settlementDate = isDebit
        ? addBusinessDays(paymentDate, settlementDays)
        : addDays(paymentDate, settlementDays);

      return {
        type: "single" as const,
        rate,
        feeAmount,
        netAmount,
        settlementDays,
        settlementDate,
      };
    }
  }, [terminal, amount, paymentMethod, installmentsCount, paymentDate]);

  if (!mdrCalc) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (mdrCalc.type === "installment") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CreditCardIcon className="h-4 w-4" />
          Detalhes da Maquininha: {terminal.name} ({mdrCalc.count}x)
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Taxa:</span>
          <span className="font-medium">{mdrCalc.rate.toFixed(2)}%</span>

          <span className="text-muted-foreground">Valor bruto total:</span>
          <span className="font-medium">{formatCurrency(amount)}</span>

          <span className="text-muted-foreground">Bruto por parcela:</span>
          <span className="font-medium">{formatCurrency(mdrCalc.grossPerInstallment)}</span>

          <span className="text-muted-foreground">MDR por parcela:</span>
          <span className="font-medium text-destructive">
            -{formatCurrency(mdrCalc.feePerInstallment)}
          </span>

          <span className="text-muted-foreground">Líquido por parcela:</span>
          <span className="font-semibold text-primary">
            {formatCurrency(mdrCalc.netPerInstallment)}
          </span>

          <span className="text-muted-foreground">Total líquido:</span>
          <span className="font-semibold text-primary">
            {formatCurrency(mdrCalc.totalNet)}
          </span>
        </div>
        <div className="mt-2 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Datas de recebimento:</span>
          {mdrCalc.autoAnticipation ? (
            <div className="text-xs bg-background border border-border rounded px-2 py-1">
              Todas as parcelas em D+{mdrCalc.settlementDays} ({format(mdrCalc.installmentDates[0], "dd/MM/yyyy", { locale: ptBR })})
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {mdrCalc.installmentDates.map((date, i) => (
                <span key={i} className="text-xs bg-background border border-border rounded px-2 py-0.5">
                  {i + 1}/{mdrCalc.count}: {format(date, "dd/MM/yyyy", { locale: ptBR })}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CreditCardIcon className="h-4 w-4" />
        Detalhes da Maquininha: {terminal.name}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Taxa:</span>
        <span className="font-medium">{mdrCalc.rate.toFixed(2)}%</span>

        <span className="text-muted-foreground">Valor bruto:</span>
        <span className="font-medium">{formatCurrency(amount)}</span>

        <span className="text-muted-foreground">Desconto MDR:</span>
        <span className="font-medium text-destructive">
          -{formatCurrency(mdrCalc.feeAmount)}
        </span>

        <span className="text-muted-foreground">Valor líquido:</span>
        <span className="font-semibold text-primary">
          {formatCurrency(mdrCalc.netAmount)}
        </span>

        <span className="text-muted-foreground">Recebimento em:</span>
        <span className="font-medium">
          D+{mdrCalc.settlementDays} (
          {format(mdrCalc.settlementDate, "dd/MM/yyyy", { locale: ptBR })})
        </span>
      </div>
    </div>
  );
}

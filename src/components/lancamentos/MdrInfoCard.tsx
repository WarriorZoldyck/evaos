import { useMemo } from "react";
import { format } from "date-fns";
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
      // For credit: use installment-specific rate from rates_info if available
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

    const feeAmount = Math.round(amount * (rate / 100) * 100) / 100;
    const netAmount = Math.round((amount - feeAmount) * 100) / 100;
    const settlementDate = addBusinessDays(paymentDate, settlementDays);

    return { rate, feeAmount, netAmount, settlementDays, settlementDate };
  }, [terminal, amount, paymentMethod, installmentsCount, paymentDate]);

  if (!mdrCalc) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

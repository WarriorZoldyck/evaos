import { useState, useMemo } from "react";
import { addMonths, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface InstallmentPreviewTableProps {
  totalAmount: number;
  installmentsCount: number;
  paymentDate: Date;
  intervalType: "monthly" | "custom_days";
  customDays?: number;
  interestRate: number;
  customAmounts: Record<number, number>;
  onCustomAmountsChange: (amounts: Record<number, number>) => void;
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
}: InstallmentPreviewTableProps) {
  const [distribute, setDistribute] = useState(true);

  const hasInterest = interestRate > 0;
  const n = installmentsCount;

  const installments = useMemo(() => {
    const result: { number: number; date: Date; amount: number }[] = [];

    if (hasInterest) {
      // Price system — fixed installments, read-only
      const i = interestRate / 100;
      const pmt =
        Math.round(
          totalAmount *
            ((i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)) *
            100
        ) / 100;

      for (let idx = 0; idx < n; idx++) {
        const date =
          intervalType === "custom_days" && customDays
            ? addDays(paymentDate, idx * customDays)
            : addMonths(paymentDate, idx);
        result.push({ number: idx + 1, date, amount: pmt });
      }
    } else {
      const defaultPmt = Math.round((totalAmount / n) * 100) / 100;
      const editedIndices = Object.keys(customAmounts).map(Number);
      const hasEdits = editedIndices.length > 0;

      if (hasEdits && distribute) {
        // Sum of custom amounts
        const customSum = editedIndices.reduce((sum, idx) => sum + (customAmounts[idx] || 0), 0);
        const remaining = totalAmount - customSum;
        const nonEditedCount = n - editedIndices.length;
        const otherAmount = nonEditedCount > 0 ? Math.round((remaining / nonEditedCount) * 100) / 100 : 0;

        for (let idx = 0; idx < n; idx++) {
          const date =
            intervalType === "custom_days" && customDays
              ? addDays(paymentDate, idx * customDays)
              : addMonths(paymentDate, idx);
          const instNum = idx + 1;
          const amount = customAmounts[instNum] !== undefined ? customAmounts[instNum] : otherAmount;
          result.push({ number: instNum, date, amount });
        }
      } else {
        for (let idx = 0; idx < n; idx++) {
          const date =
            intervalType === "custom_days" && customDays
              ? addDays(paymentDate, idx * customDays)
              : addMonths(paymentDate, idx);
          const instNum = idx + 1;
          const amount = customAmounts[instNum] !== undefined ? customAmounts[instNum] : defaultPmt;
          result.push({ number: instNum, date, amount });
        }
      }
    }

    return result;
  }, [totalAmount, n, paymentDate, intervalType, customDays, interestRate, hasInterest, customAmounts, distribute]);

  const total = useMemo(
    () => installments.reduce((sum, inst) => sum + inst.amount, 0),
    [installments]
  );

  const totalInterest = hasInterest ? Math.round((total - totalAmount) * 100) / 100 : 0;

  const hasEdits = Object.keys(customAmounts).length > 0;

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

  return (
    <div className="space-y-2">
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
            {installments.map((inst) => (
              <TableRow key={inst.number} className="hover:bg-transparent">
                <TableCell className="py-1.5 px-3 text-xs text-muted-foreground">
                  {inst.number}
                </TableCell>
                <TableCell className="py-1.5 px-3 text-xs">
                  {format(inst.date, "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="py-1.5 px-3 text-right">
                  {!hasInterest ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalAmount}
                      className="h-7 w-28 text-xs text-right ml-auto"
                      value={
                        customAmounts[inst.number] ??
                        Math.round((totalAmount / n) * 100) / 100
                      }
                      onChange={(e) => handleAmountChange(inst.number, e.target.value)}
                    />
                  ) : (
                    <span className="text-xs">
                      {formatCurrency(inst.amount)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
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

      {/* Distribute checkbox — only when any installment was edited and no interest */}
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

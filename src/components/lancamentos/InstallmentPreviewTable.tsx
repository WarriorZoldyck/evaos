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
  firstInstallmentAmount?: number;
  onFirstInstallmentChange: (value: number | undefined) => void;
}

export function InstallmentPreviewTable({
  totalAmount,
  installmentsCount,
  paymentDate,
  intervalType,
  customDays,
  interestRate,
  firstInstallmentAmount,
  onFirstInstallmentChange,
}: InstallmentPreviewTableProps) {
  const [distribute, setDistribute] = useState(true);

  const hasInterest = interestRate > 0;

  const installments = useMemo(() => {
    const n = installmentsCount;
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
      // No interest — allow editing 1st installment
      const defaultPmt = Math.round((totalAmount / n) * 100) / 100;
      const first = firstInstallmentAmount ?? defaultPmt;

      for (let idx = 0; idx < n; idx++) {
        const date =
          intervalType === "custom_days" && customDays
            ? addDays(paymentDate, idx * customDays)
            : addMonths(paymentDate, idx);

        if (idx === 0) {
          result.push({ number: 1, date, amount: first });
        } else {
          const remaining = totalAmount - first;
          const otherAmount = distribute
            ? Math.round((remaining / (n - 1)) * 100) / 100
            : defaultPmt;
          result.push({ number: idx + 1, date, amount: otherAmount });
        }
      }
    }

    return result;
  }, [
    totalAmount,
    installmentsCount,
    paymentDate,
    intervalType,
    customDays,
    interestRate,
    hasInterest,
    firstInstallmentAmount,
    distribute,
  ]);

  const total = useMemo(
    () => installments.reduce((sum, inst) => sum + inst.amount, 0),
    [installments]
  );

  const totalInterest = hasInterest ? Math.round((total - totalAmount) * 100) / 100 : 0;

  const isFirstEdited =
    firstInstallmentAmount !== undefined &&
    firstInstallmentAmount !== Math.round((totalAmount / installmentsCount) * 100) / 100;

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

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
                  {inst.number === 1 && !hasInterest ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalAmount}
                      className="h-7 w-28 text-xs text-right ml-auto"
                      value={
                        firstInstallmentAmount ??
                        Math.round((totalAmount / installmentsCount) * 100) /
                          100
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val === 0) {
                          onFirstInstallmentChange(undefined);
                        } else {
                          onFirstInstallmentChange(val);
                        }
                      }}
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

      {/* Distribute checkbox — only when first installment was edited and no interest */}
      {!hasInterest && isFirstEdited && (
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

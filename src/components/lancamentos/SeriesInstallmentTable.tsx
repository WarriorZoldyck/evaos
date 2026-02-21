import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";

interface SeriesTransaction {
  id: string;
  installment_number: number | null;
  payment_date: string;
  amount: number;
  status: string;
  original_amount: number | null;
}

interface SeriesInstallmentTableProps {
  seriesId: string;
  onAmountsChanged: (updates: Array<{ id: string; amount: number }>) => void;
}

export function SeriesInstallmentTable({
  seriesId,
  onAmountsChanged,
}: SeriesInstallmentTableProps) {
  const [installments, setInstallments] = useState<SeriesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [distribute, setDistribute] = useState(true);

  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("id, installment_number, payment_date, amount, status, original_amount")
        .eq("series_id", seriesId)
        .order("installment_number", { ascending: true });
      setInstallments((data as SeriesTransaction[]) || []);
      setCustomAmounts({});
      setLoading(false);
    };
    fetchSeries();
  }, [seriesId]);

  const pendingInstallments = useMemo(
    () => installments.filter((i) => i.status === "Pendente"),
    [installments]
  );

  const originalTotal = useMemo(() => {
    if (installments.length === 0) return 0;
    // Use original_amount from any installment, or sum all amounts
    const oa = installments[0]?.original_amount;
    return oa ?? installments.reduce((s, i) => s + i.amount, 0);
  }, [installments]);

  // Calculate displayed amounts considering redistribution
  const displayAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    const editedIds = Object.keys(customAmounts);
    const hasEdits = editedIds.length > 0;

    if (hasEdits && distribute) {
      // Sum paid amounts
      const paidSum = installments
        .filter((i) => i.status === "Pago")
        .reduce((s, i) => s + i.amount, 0);
      // Sum custom edited amounts
      const customSum = editedIds.reduce((s, id) => s + (customAmounts[id] || 0), 0);
      // Remaining for non-edited pending
      const nonEditedPending = pendingInstallments.filter((i) => customAmounts[i.id] === undefined);
      const remaining = originalTotal - paidSum - customSum;
      const perNonEdited = nonEditedPending.length > 0
        ? Math.round((remaining / nonEditedPending.length) * 100) / 100
        : 0;

      installments.forEach((inst) => {
        if (inst.status === "Pago") {
          amounts[inst.id] = inst.amount;
        } else if (customAmounts[inst.id] !== undefined) {
          amounts[inst.id] = customAmounts[inst.id];
        } else {
          amounts[inst.id] = perNonEdited;
        }
      });
    } else {
      installments.forEach((inst) => {
        amounts[inst.id] = customAmounts[inst.id] ?? inst.amount;
      });
    }

    return amounts;
  }, [installments, customAmounts, distribute, pendingInstallments, originalTotal]);

  // Notify parent of changes
  useEffect(() => {
    const updates: Array<{ id: string; amount: number }> = [];
    installments.forEach((inst) => {
      if (inst.status === "Pendente") {
        const displayed = displayAmounts[inst.id];
        if (displayed !== undefined && displayed !== inst.amount) {
          updates.push({ id: inst.id, amount: displayed });
        }
      }
    });
    onAmountsChanged(updates);
  }, [displayAmounts, installments]);

  const total = useMemo(
    () => Object.values(displayAmounts).reduce((s, v) => s + v, 0),
    [displayAmounts]
  );

  const hasEdits = Object.keys(customAmounts).length > 0;

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Carregando parcelas...</span>
      </div>
    );
  }

  if (installments.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Parcelas da série</Label>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs w-10">#</TableHead>
              <TableHead className="h-8 px-3 text-xs">Vencimento</TableHead>
              <TableHead className="h-8 px-3 text-xs text-center w-20">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs text-right">Valor (R$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((inst) => {
              const isPaid = inst.status === "Pago";
              return (
                <TableRow
                  key={inst.id}
                  className={isPaid ? "bg-muted/30 hover:bg-muted/30" : "hover:bg-transparent"}
                >
                  <TableCell className="py-1.5 px-3 text-xs text-muted-foreground">
                    {inst.installment_number ?? "-"}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-xs">
                    {format(new Date(inst.payment_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-center">
                    <Badge
                      variant={isPaid ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {inst.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-right">
                    {isPaid ? (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(inst.amount)}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-7 w-28 text-xs text-right ml-auto"
                        value={displayAmounts[inst.id] ?? inst.amount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val) || val === 0) {
                            const next = { ...customAmounts };
                            delete next[inst.id];
                            setCustomAmounts(next);
                          } else {
                            setCustomAmounts({ ...customAmounts, [inst.id]: val });
                          }
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Total row */}
            <TableRow className="border-t font-medium hover:bg-transparent">
              <TableCell className="py-1.5 px-3 text-xs" colSpan={3}>
                Total
              </TableCell>
              <TableCell className="py-1.5 px-3 text-xs text-right font-semibold">
                R$ {formatCurrency(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {hasEdits && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="distribute-series-diff"
            checked={distribute}
            onCheckedChange={(checked) => setDistribute(!!checked)}
          />
          <Label htmlFor="distribute-series-diff" className="text-xs text-muted-foreground cursor-pointer">
            Distribuir diferença nas demais parcelas pendentes
          </Label>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type AccountType = "bank" | "wallet" | "card";

interface AccountStatementModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountType: AccountType;
  accountName: string;
  initialBalance?: number;
}

interface StatementRow {
  id: string;
  payment_date: string;
  description: string;
  type: "receita" | "despesa";
  amount: number;
  status: string;
  category: string;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AccountStatementModal({
  open,
  onClose,
  accountId,
  accountType,
  accountName,
  initialBalance = 0,
}: AccountStatementModalProps) {
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refMonth, setRefMonth] = useState(new Date());

  const dateFrom = format(startOfMonth(refMonth), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(refMonth), "yyyy-MM-dd");

  useEffect(() => {
    if (!open || !accountId) return;

    const fetchStatement = async () => {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select("id, payment_date, description, type, amount, status, category")
        .gte("payment_date", dateFrom)
        .lte("payment_date", dateTo)
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (accountType === "bank") query = query.eq("bank_account_id", accountId);
      else if (accountType === "wallet") query = query.eq("wallet_id", accountId);
      else query = query.eq("credit_card_id", accountId);

      const { data, error } = await query;

      if (!error && data) {
        setRows(data as StatementRow[]);
      }
      setLoading(false);
    };

    fetchStatement();
  }, [open, accountId, accountType, dateFrom, dateTo]);

  // For bank/wallet, also fetch all paid transactions BEFORE the period to compute carry-over balance
  const [priorBalance, setPriorBalance] = useState(0);

  useEffect(() => {
    if (!open || !accountId || accountType === "card") {
      setPriorBalance(initialBalance);
      return;
    }

    const fetchPrior = async () => {
      let query = supabase
        .from("transactions")
        .select("type, amount")
        .eq("status", "Pago")
        .lt("payment_date", dateFrom);

      if (accountType === "bank") query = query.eq("bank_account_id", accountId);
      else query = query.eq("wallet_id", accountId);

      const { data } = await query;

      if (data) {
        const sum = data.reduce((acc, t) => {
          return acc + (t.type === "receita" ? t.amount : -t.amount);
        }, 0);
        setPriorBalance(initialBalance + sum);
      }
    };

    fetchPrior();
  }, [open, accountId, accountType, dateFrom, initialBalance]);

  const rowsWithBalance = useMemo(() => {
    let running = accountType === "card" ? 0 : priorBalance;
    return rows.map((r) => {
      if (r.status === "Pago") {
        running += r.type === "receita" ? r.amount : -r.amount;
      }
      return { ...r, balance: running };
    });
  }, [rows, priorBalance, accountType]);

  const monthLabel = format(refMonth, "MMMM yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Extrato — {accountName}
            {accountType === "card" && (
              <Badge variant="outline" className="text-xs">Cartão</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Month navigation */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefMonth(subMonths(refMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefMonth(addMonths(refMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Prior balance */}
        {accountType !== "card" && (
          <div className="text-sm text-muted-foreground px-1">
            Saldo anterior: <span className="font-mono font-medium text-foreground">{formatCurrency(priorBalance)}</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma movimentação neste período
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Data</th>
                  <th className="text-left p-2 font-medium">Descrição</th>
                  <th className="text-right p-2 font-medium">Entrada</th>
                  <th className="text-right p-2 font-medium">Saída</th>
                  {accountType !== "card" && (
                    <th className="text-right p-2 font-medium">Saldo</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rowsWithBalance.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.payment_date + "T00:00:00"), "dd/MM")}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {r.description}
                        {r.status === "Pendente" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pendente</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {r.type === "receita" ? formatCurrency(r.amount) : ""}
                    </td>
                    <td className="p-2 text-right font-mono text-red-600 dark:text-red-400">
                      {r.type === "despesa" ? formatCurrency(r.amount) : ""}
                    </td>
                    {accountType !== "card" && (
                      <td className={`p-2 text-right font-mono font-medium ${r.balance >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(r.balance)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

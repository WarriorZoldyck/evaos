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
  transfer_id?: string | null;
  peerAccount?: string | null;
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
        .select("id, payment_date, description, type, amount, status, category, credit_card_id, transfer_id, bank_account_id, wallet_id")
        .eq("status", "Pago")
        .gte("payment_date", dateFrom)
        .lte("payment_date", dateTo)
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (accountType === "bank") query = query.eq("bank_account_id", accountId);
      else if (accountType === "wallet") query = query.eq("wallet_id", accountId);
      else {
        query = query.eq("credit_card_id", accountId);
        // Extrato de fatura: transferências entre contas nunca devem aparecer.
        query = query.is("transfer_id", null);
      }

      const { data, error } = await query;

      if (!error && data) {
        const transferIds = Array.from(new Set(data.map((r: any) => r.transfer_id).filter(Boolean)));
        const peerByTxId = new Map<string, string>();

        if (transferIds.length > 0) {
          const { data: peers } = await supabase
            .from("transactions")
            .select("id, transfer_id, bank_account_id, wallet_id")
            .in("transfer_id", transferIds);

          const peerBankIds = Array.from(new Set((peers || []).map((p: any) => p.bank_account_id).filter(Boolean)));
          const peerWalletIds = Array.from(new Set((peers || []).map((p: any) => p.wallet_id).filter(Boolean)));
          const [bankRes, walletRes] = await Promise.all([
            peerBankIds.length > 0
              ? supabase.from("bank_accounts").select("id, name").in("id", peerBankIds)
              : Promise.resolve({ data: [] as any[] }),
            peerWalletIds.length > 0
              ? supabase.from("wallets").select("id, name").in("id", peerWalletIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          const accountNames = new Map<string, string>();
          (bankRes.data || []).forEach((a: any) => accountNames.set(a.id, a.name));
          (walletRes.data || []).forEach((w: any) => accountNames.set(w.id, w.name));

          data.forEach((row: any) => {
            if (!row.transfer_id) return;
            const peer = (peers || []).find((p: any) => p.transfer_id === row.transfer_id && p.id !== row.id);
            const peerName = peer ? accountNames.get(peer.bank_account_id || peer.wallet_id) : null;
            if (peerName) peerByTxId.set(row.id, peerName);
          });
        }

        const withPeer = data.map((row: any) => ({ ...row, peerAccount: peerByTxId.get(row.id) ?? null }));

        if (accountType === "card") {
          // Card statement: show every transaction as-is
          setRows(withPeer.map(({ credit_card_id: _c, bank_account_id: _b, wallet_id: _w, ...r }) => r) as StatementRow[]);
        } else {
          // Bank/wallet statement: hide individual card purchases (rows with credit_card_id)
          // and replace them with a single synthetic "Pagamento Fatura X" line per
          // (card, payment_date), so the user only sees the bill payment.
          const direct: StatementRow[] = [];
          const billGroups: Record<string, { amount: number; date: string; cardId: string }> = {};

          for (const r of withPeer) {
            if (r.credit_card_id) {
              const key = `${r.credit_card_id}__${r.payment_date}`;
              if (!billGroups[key]) {
                billGroups[key] = { amount: 0, date: r.payment_date, cardId: r.credit_card_id };
              }
              // Sum despesa as positive bill, receita (refund/credit) reduces it
              billGroups[key].amount += r.type === "despesa" ? r.amount : -r.amount;
            } else {
              const { credit_card_id: _c, bank_account_id: _b, wallet_id: _w, ...rest } = r;
              direct.push(rest as StatementRow);
            }
          }

          // Resolve card names in a single query
          const cardIds = Array.from(new Set(Object.values(billGroups).map((g) => g.cardId)));
          let cardNames: Record<string, string> = {};
          if (cardIds.length > 0) {
            const { data: cards } = await supabase
              .from("credit_cards")
              .select("id, name")
              .in("id", cardIds);
            cardNames = Object.fromEntries((cards || []).map((c: any) => [c.id, c.name]));
          }

          const synthetic: StatementRow[] = Object.entries(billGroups)
            .filter(([, g]) => Math.abs(g.amount) > 0.005)
            .map(([key, g]) => ({
              id: `bill__${key}`,
              payment_date: g.date,
              description: `Pagamento fatura ${cardNames[g.cardId] || "cartão"}`,
              type: g.amount >= 0 ? "despesa" : "receita",
              amount: Math.abs(g.amount),
              status: "Pago",
              category: "Cartão de Crédito",
            }));

          const merged = [...direct, ...synthetic].sort((a, b) =>
            a.payment_date.localeCompare(b.payment_date)
          );
          setRows(merged);
        }
      }
      setLoading(false);
    };

    fetchStatement();
  }, [open, accountId, accountType, dateFrom, dateTo]);

  // For bank/wallet, also fetch all paid transactions BEFORE the period to compute carry-over balance
  // (uses the same logic: card purchases collapse into bill payments, so the balance math is
  // identical to what the user sees in the visible rows)
  const [priorBalance, setPriorBalance] = useState(0);

  useEffect(() => {
    if (!open || !accountId || accountType === "card") {
      setPriorBalance(initialBalance);
      return;
    }

    const fetchPrior = async () => {
      // Direct (non-card) prior transactions
      let directQ = supabase
        .from("transactions")
        .select("type, amount")
        .eq("status", "Pago")
        .is("credit_card_id", null)
        .lt("payment_date", dateFrom);
      if (accountType === "bank") directQ = directQ.eq("bank_account_id", accountId);
      else directQ = directQ.eq("wallet_id", accountId);

      // Prior card bill payments routed to this account (despesa adds to debit, receita subtracts)
      let billQ = supabase
        .from("transactions")
        .select("type, amount")
        .eq("status", "Pago")
        .not("credit_card_id", "is", null)
        .lt("payment_date", dateFrom);
      if (accountType === "bank") billQ = billQ.eq("bank_account_id", accountId);
      else billQ = billQ.eq("wallet_id", accountId);

      const [{ data: dData }, { data: bData }] = await Promise.all([directQ, billQ]);
      const sumDirect = (dData || []).reduce(
        (acc, t: any) => acc + (t.type === "receita" ? t.amount : -t.amount),
        0
      );
      const sumBill = (bData || []).reduce(
        (acc, t: any) => acc + (t.type === "receita" ? t.amount : -t.amount),
        0
      );
      setPriorBalance(initialBalance + sumDirect + sumBill);
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
                      {r.peerAccount && (
                        <div className="text-[10px] text-primary/80 mt-0.5">
                          {r.type === "receita" ? "Origem" : "Destino"}: {r.peerAccount}
                        </div>
                      )}
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

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Repeat, CreditCard, Trash2 } from "lucide-react";
import { LiquidateModal } from "./LiquidateModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import type { CreditCardInfo } from "@/hooks/useDashboardData";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  status: "Pendente" | "Pago";
  payment_date: string;
  category: string;
  bank_account_id: string | null;
  contact_name: string | null;
  series_id: string | null;
  credit_card_id: string | null;
  isRecurring?: boolean;
  // Fields from recurring occurrences
  competence_date?: string;
  subcategory?: string | null;
  wallet_id?: string | null;
  company_id?: string | null;
  payment_method?: string | null;
}

interface UpcomingTransactionsProps {
  transactions: Transaction[];
  creditCards: CreditCardInfo[];
  loading: boolean;
  onLiquidated: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface CreditCardBill {
  cardId: string;
  cardName: string;
  lastFour: string | null;
  billingMonth: string;
  total: number;
  transactions: Transaction[];
  bankAccountId: string;
}

function getBillingMonth(paymentDate: string, closingDay: number): string {
  const date = parseISO(paymentDate);
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  if (day > closingDay) {
    const nextMonth = month + 1;
    if (nextMonth > 11) {
      return `${year + 1}-01`;
    }
    return `${year}-${String(nextMonth + 1).padStart(2, "0")}`;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Extract the real recurring_transactions UUID from synthetic ID like rec_UUID_2026-02-18 */
function extractRecurringId(syntheticId: string): string {
  return syntheticId.replace(/^rec_/, "").replace(/_\d{4}-\d{2}-\d{2}$/, "");
}

export function UpcomingTransactions({ transactions, creditCards, loading, onLiquidated }: UpcomingTransactionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [materializing, setMaterializing] = useState(false);

  const { regularTransactions, creditCardBills } = useMemo(() => {
    const cardMap = new Map(creditCards.map((c) => [c.id, c]));
    const billMap = new Map<string, CreditCardBill>();
    const regular: Transaction[] = [];

    transactions.forEach((t) => {
      if (t.credit_card_id && cardMap.has(t.credit_card_id) && !t.isRecurring) {
        const card = cardMap.get(t.credit_card_id)!;
        const billingMonth = getBillingMonth(t.payment_date, card.closing_day);
        const key = `${t.credit_card_id}:${billingMonth}`;

        if (!billMap.has(key)) {
          billMap.set(key, {
            cardId: card.id,
            cardName: card.name,
            lastFour: card.last_four_digits,
            billingMonth,
            total: 0,
            transactions: [],
            bankAccountId: card.bank_account_id,
          });
        }
        const bill = billMap.get(key)!;
        bill.total += t.type === "receita" ? -Number(t.amount) : Number(t.amount);
        bill.transactions.push(t);
      } else {
        regular.push(t);
      }
    });

    return {
      regularTransactions: regular,
      creditCardBills: Array.from(billMap.values()).sort((a, b) => a.billingMonth.localeCompare(b.billingMonth)),
    };
  }, [transactions, creditCards]);

  const formatBillingMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return format(date, "MMM/yyyy", { locale: ptBR });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    if (deleteTarget.isRecurring) {
      // Delete from recurring_transactions table
      const realId = extractRecurringId(deleteTarget.id);
      const { error } = await supabase.from("recurring_transactions").delete().eq("id", realId);
      setDeleting(false);
      if (error) {
        toast.error("Erro ao excluir lançamento recorrente");
      } else {
        toast.success("Lançamento recorrente excluído");
        setDeleteTarget(null);
        onLiquidated();
      }
    } else {
      const { error } = await supabase.from("transactions").delete().eq("id", deleteTarget.id);
      setDeleting(false);
      if (error) {
        toast.error("Erro ao excluir lançamento");
      } else {
        toast.success("Lançamento excluído");
        setDeleteTarget(null);
        onLiquidated();
      }
    }
  };

  /** Materialize a recurring occurrence into a real transaction, then open LiquidateModal */
  const handleLiquidateRecurring = async (t: Transaction) => {
    if (!user) return;
    setMaterializing(true);

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        description: t.description,
        amount: t.amount,
        type: t.type,
        status: "Pendente" as const,
        payment_date: t.payment_date,
        competence_date: t.competence_date || t.payment_date,
        category: t.category,
        subcategory: t.subcategory || null,
        bank_account_id: t.bank_account_id,
        credit_card_id: t.credit_card_id,
        wallet_id: t.wallet_id || null,
        company_id: isPersonal ? null : (t.company_id || selectedCompanyId || null),
        contact_name: t.contact_name,
        series_id: t.series_id,
        payment_method: t.payment_method || null,
        user_id: effectiveUserId,
      })
      .select("id")
      .single();

    setMaterializing(false);

    if (error || !data) {
      toast.error("Erro ao preparar lançamento para liquidação");
      return;
    }

    // Open liquidate modal with the newly created real transaction
    setSelectedTransaction({
      ...t,
      id: data.id,
      isRecurring: false,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Próximos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : regularTransactions.length === 0 && creditCardBills.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum lançamento pendente
            </div>
          ) : (
            <div className="space-y-2">
              {/* Credit card bills grouped */}
              {creditCardBills.map((bill) => (
                <div
                  key={`bill-${bill.cardId}-${bill.billingMonth}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CreditCard className="h-5 w-5 text-destructive shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        Fatura {bill.cardName}
                        {bill.lastFour ? ` •••• ${bill.lastFour}` : ""}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{formatBillingMonth(bill.billingMonth)}</span>
                        <span>·</span>
                        <span>{bill.transactions.length} lançamento{bill.transactions.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-destructive">
                      - {formatCurrency(bill.total)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => setSelectedBill(bill)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pagar Fatura
                    </Button>
                  </div>
                </div>
              ))}

              {/* Regular transactions */}
              {regularTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() => {
                    if (!t.isRecurring) {
                      navigate(`/lancamentos?search=${encodeURIComponent(t.description)}&dateFrom=${t.payment_date}&dateTo=${t.payment_date}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.type === "receita" ? (
                      <ArrowUpCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                        {t.isRecurring && (
                          <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(t.payment_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <span>·</span>
                        <span className="truncate">{t.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`text-sm font-semibold ${
                        t.type === "receita" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {t.type === "despesa" ? "- " : "+ "}
                      {formatCurrency(t.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                      disabled={materializing}
                      onClick={() => {
                        if (t.isRecurring) {
                          handleLiquidateRecurring(t);
                        } else {
                          setSelectedTransaction(t);
                        }
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Liquidar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single transaction liquidation */}
      <LiquidateModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onSuccess={() => {
          setSelectedTransaction(null);
          onLiquidated();
        }}
      />

      {/* Bulk credit card bill liquidation */}
      <LiquidateModal
        transaction={selectedBill ? {
          id: selectedBill.transactions[0].id,
          description: `Fatura ${selectedBill.cardName} - ${formatBillingMonth(selectedBill.billingMonth)}`,
          amount: selectedBill.total,
          type: "despesa",
          payment_date: selectedBill.transactions[0].payment_date,
          bank_account_id: selectedBill.bankAccountId,
          series_id: null,
          credit_card_id: selectedBill.cardId,
        } : null}
        bulkTransactionIds={selectedBill?.transactions.map((t) => t.id)}
        onClose={() => setSelectedBill(null)}
        onSuccess={() => {
          setSelectedBill(null);
          onLiquidated();
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.isRecurring ? "Excluir lançamento recorrente" : "Excluir lançamento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.isRecurring
                ? `Tem certeza que deseja excluir a recorrência "${deleteTarget?.description}"? Todas as ocorrências futuras serão removidas.`
                : `Tem certeza que deseja excluir "${deleteTarget?.description}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

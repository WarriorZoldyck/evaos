import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { LiquidateModal } from "./LiquidateModal";

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
}

interface UpcomingTransactionsProps {
  transactions: Transaction[];
  loading: boolean;
  onLiquidated: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function UpcomingTransactions({ transactions, loading, onLiquidated }: UpcomingTransactionsProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
          ) : transactions.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum lançamento pendente
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.type === "receita" ? (
                      <ArrowUpCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(t.payment_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <span>·</span>
                        <span className="truncate">{t.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
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
                      size="sm"
                      className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => setSelectedTransaction(t)}
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

      <LiquidateModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onSuccess={() => {
          setSelectedTransaction(null);
          onLiquidated();
        }}
      />
    </>
  );
}

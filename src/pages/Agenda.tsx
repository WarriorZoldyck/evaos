import { useState, useEffect, useMemo } from "react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiquidateModal } from "@/components/dashboard/LiquidateModal";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PeriodDays = 7 | 15 | 30 | 60;

interface AgendaTransaction {
  id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  payment_date: string;
  category: string;
  status: string;
  bank_account_id: string | null;
  credit_card_id: string | null;
  series_id: string | null;
  subcategory: string | null;
  subcategory2: string | null;
  installment_number: number | null;
  installments_total: number | null;
  original_amount: number | null;
}

export default function Agenda() {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [transactions, setTransactions] = useState<AgendaTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [liquidateTarget, setLiquidateTarget] = useState<AgendaTransaction | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAgenda = async () => {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), period), "yyyy-MM-dd");

      let query = supabase
        .from("transactions")
        .select("id, description, amount, type, payment_date, category, status, bank_account_id, credit_card_id, series_id, subcategory, subcategory2, installment_number, installments_total, original_amount")
        .eq("status", "Pendente")
        .gte("payment_date", today)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: true });

      if (isPersonal) {
        query = query.is("company_id", null);
      } else if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data } = await query;
      setTransactions((data as AgendaTransaction[]) || []);
      setLoading(false);
    };

    fetchAgenda();
  }, [user, period, selectedCompanyId, isPersonal]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaTransaction[]>();
    transactions.forEach((t) => {
      const key = t.payment_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [transactions]);

  const totalReceitas = transactions.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
  const totalDespesas = transactions.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);

  const refreshAfterLiquidate = () => {
    setLiquidateTarget(null);
    // Re-trigger fetch by toggling period
    setPeriod((p) => p);
    // Simple re-fetch
    const event = new Event("transaction-created");
    window.dispatchEvent(event);
    // Force re-render
    setTransactions((prev) => prev.filter((t) => t.id !== liquidateTarget?.id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Agenda Financeira</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {transactions.length} compromisso{transactions.length !== 1 ? "s" : ""} pendente{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {([7, 15, 30, 60] as PeriodDays[]).map((d) => (
            <Button
              key={d}
              variant={period === d ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setPeriod(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpCircle className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Entradas previstas</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalReceitas)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownCircle className="h-8 w-8 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Saídas previstas</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalDespesas)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${totalReceitas - totalDespesas >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <span className="text-sm font-bold">=</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo previsto</p>
              <p className={`text-lg font-bold font-mono ${totalReceitas - totalDespesas >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(totalReceitas - totalDespesas)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agenda list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum compromisso pendente nos próximos {period} dias
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateStr, items]) => {
            const date = parseISO(dateStr);
            const isToday = isSameDay(date, new Date());
            return (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  {isToday && <Badge className="text-[10px]">Hoje</Badge>}
                </div>
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {items.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        {t.type === "receita" ? (
                          <ArrowUpCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.description}</p>
                          <p className="text-xs text-muted-foreground">{t.category}</p>
                        </div>
                        <span className={`font-mono text-sm font-medium ${t.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {t.type === "despesa" ? "- " : ""}{formatCurrency(t.amount)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs shrink-0"
                          onClick={() => setLiquidateTarget(t)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Liquidar
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Liquidate modal */}
      <LiquidateModal
        transaction={
          liquidateTarget
            ? {
                id: liquidateTarget.id,
                description: liquidateTarget.description,
                amount: liquidateTarget.amount,
                type: liquidateTarget.type,
                payment_date: liquidateTarget.payment_date,
                bank_account_id: liquidateTarget.bank_account_id,
                series_id: liquidateTarget.series_id,
                credit_card_id: liquidateTarget.credit_card_id,
                category: liquidateTarget.category,
                subcategory: liquidateTarget.subcategory,
                subcategory2: liquidateTarget.subcategory2,
                installment_number: liquidateTarget.installment_number,
                installments_total: liquidateTarget.installments_total,
                original_amount: liquidateTarget.original_amount,
              }
            : null
        }
        onClose={() => setLiquidateTarget(null)}
        onSuccess={refreshAfterLiquidate}
      />
    </div>
  );
}

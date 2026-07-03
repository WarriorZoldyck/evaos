import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ArrowRight, ChevronRight, ChevronDown } from "lucide-react";

type Tx = {
  id: string;
  description: string;
  amount: number;
  original_amount: number | null;
  type: "receita" | "despesa";
  status: string;
  competence_date: string;
  payment_date: string;
  category: string;
  contact_name: string | null;
  series_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
  payment_method: string | null;
  credit_card_id: string | null;
};

interface FaturamentoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competenceTransactions: Tx[];
  total: number;
  prevTotal?: number;
  dateFrom: string;
  dateTo: string;
  categoryNameResolver?: (id: string) => string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

const grossOf = (t: Tx) => Number(t.original_amount ?? t.amount);

function normalizeMethod(t: Tx): string {
  const m = (t.payment_method || "").toLowerCase().trim();
  if (m.includes("pix")) return "PIX";
  if (m.includes("boleto")) return "boleto";
  if (m.includes("dinheiro") || m.includes("espécie") || m.includes("especie")) return "dinheiro";
  if (m.includes("débito") || m.includes("debito")) return "débito";
  if (m.includes("crédito") || m.includes("credito")) return "cartão";
  if (m.includes("transfer")) return "transferência";
  if (t.credit_card_id) return "cartão";
  if (t.original_amount && Number(t.original_amount) > 0) return "maquininha";
  return m || "—";
}

type Sale = {
  key: string;
  contactName: string;
  description: string;
  category: string;
  method: string;
  installmentsTotal: number;
  parcels: Tx[];
  grossTotal: number;
  netTotal: number;
  mdrTotal: number;
  hasPending: boolean;
  firstCompetence: string;
};

export function FaturamentoDetailModal({
  open,
  onOpenChange,
  competenceTransactions,
  total,
  prevTotal,
  dateFrom,
  dateTo,
  categoryNameResolver,
}: FaturamentoDetailModalProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 30;

  const receitas = useMemo(
    () => competenceTransactions.filter((t) => t.type === "receita"),
    [competenceTransactions],
  );

  // Agrupar por venda (series_id ou id avulso)
  const sales = useMemo<Sale[]>(() => {
    const groups = new Map<string, Tx[]>();
    receitas.forEach((t) => {
      const key = t.series_id || t.id;
      const arr = groups.get(key) || [];
      arr.push(t);
      groups.set(key, arr);
    });

    const list: Sale[] = [];
    groups.forEach((parcels, key) => {
      const sorted = [...parcels].sort(
        (a, b) => (a.installment_number || 0) - (b.installment_number || 0),
      );
      const first = sorted[0];
      const grossTotal = sorted.reduce((acc, p) => acc + grossOf(p), 0);
      const netTotal = sorted.reduce((acc, p) => acc + Number(p.amount), 0);
      list.push({
        key,
        contactName: first.contact_name || "Sem contato",
        description: first.description,
        category: categoryNameResolver ? categoryNameResolver(first.category) : first.category,
        method: normalizeMethod(first),
        installmentsTotal: first.installments_total || sorted.length,
        parcels: sorted,
        grossTotal,
        netTotal,
        mdrTotal: grossTotal - netTotal,
        hasPending: sorted.some((p) => p.status === "Pendente"),
        firstCompetence: sorted
          .map((p) => p.competence_date)
          .sort()[0],
      });
    });

    return list.sort((a, b) => b.firstCompetence.localeCompare(a.firstCompetence));
  }, [receitas, categoryNameResolver]);

  const salesCount = sales.length;
  const avg = salesCount > 0 ? total / salesCount : 0;
  const totalParcels = receitas.length;
  const delta =
    prevTotal !== undefined && prevTotal > 0
      ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
      : null;

  // Agrupamentos (mês / categoria / contato) — todos com valor bruto
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    receitas.forEach((t) => {
      const key = t.competence_date.slice(0, 7);
      map.set(key, (map.get(key) || 0) + grossOf(t));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({
        label: format(parseISO(`${k}-01`), "MMM/yyyy", { locale: ptBR }),
        value: v,
      }));
  }, [receitas]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    receitas.forEach((t) => {
      const name = categoryNameResolver
        ? categoryNameResolver(t.category)
        : t.category || "Sem categoria";
      map.set(name, (map.get(name) || 0) + grossOf(t));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [receitas, categoryNameResolver]);

  const byContact = useMemo(() => {
    const map = new Map<string, number>();
    receitas.forEach((t) => {
      const name = t.contact_name || "Sem contato";
      map.set(name, (map.get(name) || 0) + grossOf(t));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [receitas]);

  const paginated = useMemo(
    () => sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sales, page],
  );
  const totalPages = Math.max(1, Math.ceil(salesCount / PAGE_SIZE));

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const goToLancamentos = () => {
    const sp = new URLSearchParams();
    sp.set("dateFrom", dateFrom);
    sp.set("dateTo", dateTo);
    sp.set("type", "receita");
    sp.set("dateField", "competence_date");
    navigate(`/lancamentos?${sp.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary text-white flex items-center justify-center shadow-lg">
              <DollarSign className="h-4 w-4" />
            </div>
            Faturamento por competência (bruto)
          </DialogTitle>
          <DialogDescription>
            Vendas com competência entre{" "}
            <span className="font-medium text-foreground">{formatDate(dateFrom)}</span> e{" "}
            <span className="font-medium text-foreground">{formatDate(dateTo)}</span>. Valores
            brutos, antes de MDR.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Total bruto</p>
            <p className="text-lg font-bold font-display">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Vendas</p>
            <p className="text-lg font-bold font-display">{salesCount}</p>
            <p className="text-[10px] text-muted-foreground">{totalParcels} parcelas</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Ticket médio
            </p>
            <p className="text-lg font-bold font-display">{formatCurrency(avg)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
              vs anterior
            </p>
            <p
              className={`text-lg font-bold font-display ${
                delta === null
                  ? "text-muted-foreground"
                  : delta >= 0
                    ? "text-success"
                    : "text-destructive"
              }`}
            >
              {delta === null ? "—" : `${delta >= 0 ? "↗" : "↘"} ${Math.abs(delta).toFixed(1)}%`}
            </p>
          </div>
        </div>

        <Tabs defaultValue="lista" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="lista">Vendas</TabsTrigger>
            <TabsTrigger value="mes">Por mês</TabsTrigger>
            <TabsTrigger value="categoria">Por categoria</TabsTrigger>
            <TabsTrigger value="contato">Por contato</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-[45vh] pr-2">
              {paginated.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma receita encontrada para esse período.
                </p>
              ) : (
                <div className="space-y-1">
                  {paginated.map((sale) => {
                    const isOpen = expanded.has(sale.key);
                    const methodLabel =
                      sale.installmentsTotal > 1
                        ? `${sale.installmentsTotal}x ${sale.method}`
                        : `à vista ${sale.method}`;
                    return (
                      <div
                        key={sale.key}
                        className="border rounded-lg overflow-hidden bg-card/50"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(sale.key)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 text-left"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate max-w-[220px]">
                                {sale.contactName}
                              </span>
                              <Badge variant="secondary" className="text-[9px] font-normal">
                                {methodLabel}
                              </Badge>
                              {sale.hasPending && (
                                <Badge variant="outline" className="text-[9px]">
                                  contém pendente
                                </Badge>
                              )}
                              {sale.mdrTotal > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] border-destructive/40 text-destructive"
                                >
                                  MDR {formatCurrency(sale.mdrTotal)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {sale.description} · {sale.category} · {formatDate(sale.firstCompetence)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-semibold text-success">
                              {formatCurrency(sale.grossTotal)}
                            </p>
                            {sale.mdrTotal > 0 && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                líq. {formatCurrency(sale.netTotal)}
                              </p>
                            )}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t bg-muted/20 px-3 py-2">
                            <table className="w-full text-xs">
                              <thead className="text-[10px] uppercase text-muted-foreground">
                                <tr>
                                  <th className="text-left py-1 pr-2">#</th>
                                  <th className="text-left py-1 pr-2">Competência</th>
                                  <th className="text-left py-1 pr-2">Pagamento</th>
                                  <th className="text-left py-1 pr-2">Status</th>
                                  <th className="text-right py-1 pr-2">Bruto</th>
                                  <th className="text-right py-1 pr-2">MDR</th>
                                  <th className="text-right py-1">Líquido</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.parcels.map((p, idx) => {
                                  const g = grossOf(p);
                                  const n = Number(p.amount);
                                  const fee = g - n;
                                  return (
                                    <tr key={p.id} className="border-t border-border/40">
                                      <td className="py-1 pr-2 font-mono">
                                        {p.installment_number || idx + 1}
                                        {p.installments_total ? `/${p.installments_total}` : ""}
                                      </td>
                                      <td className="py-1 pr-2 font-mono">
                                        {formatDate(p.competence_date)}
                                      </td>
                                      <td className="py-1 pr-2 font-mono">
                                        {formatDate(p.payment_date)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        <Badge
                                          variant={p.status === "Pago" ? "default" : "outline"}
                                          className="text-[9px]"
                                        >
                                          {p.status}
                                        </Badge>
                                      </td>
                                      <td className="py-1 pr-2 text-right font-mono">
                                        {formatCurrency(g)}
                                      </td>
                                      <td className="py-1 pr-2 text-right font-mono text-destructive">
                                        {fee > 0 ? formatCurrency(fee) : "—"}
                                      </td>
                                      <td className="py-1 text-right font-mono">
                                        {formatCurrency(n)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 text-xs">
                <span className="text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mes" className="mt-3">
            <GroupTable rows={byMonth} total={total} />
          </TabsContent>
          <TabsContent value="categoria" className="mt-3">
            <GroupTable rows={byCategory} total={total} />
          </TabsContent>
          <TabsContent value="contato" className="mt-3">
            <GroupTable rows={byContact} total={total} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={goToLancamentos} className="gap-2">
            Ver todos os lançamentos do período
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupTable({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">Sem dados para agrupar.</p>
    );
  }
  return (
    <ScrollArea className="h-[45vh] pr-2">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr className="border-b">
            <th className="text-left py-2 pr-3">Item</th>
            <th className="text-right py-2 pr-3">% do total</th>
            <th className="text-right py-2">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = total > 0 ? (r.value / total) * 100 : 0;
            return (
              <tr key={r.label} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-3 truncate max-w-[280px]">{r.label}</td>
                <td className="py-2 pr-3 text-right text-muted-foreground font-mono text-xs">
                  {pct.toFixed(1)}%
                </td>
                <td className="py-2 text-right font-mono font-medium text-success">
                  {formatCurrency(r.value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

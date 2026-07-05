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
import { DollarSign, ArrowRight } from "lucide-react";

type Tx = {
  id: string;
  description: string;
  amount: number;
  original_amount?: number | null;
  type: "receita" | "despesa";
  status: string;
  competence_date: string;
  payment_date: string | null;
  category: string;
  contact_name: string | null;
  series_id?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
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

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

type Row = { label: string; gross: number; fee: number; net: number; count: number };

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
  const PAGE_SIZE = 50;

  const resolveCategory = (id: string) =>
    categoryNameResolver ? categoryNameResolver(id) : id || "Sem categoria";

  const receitas = useMemo(
    () =>
      competenceTransactions
        .filter((t) => t.type === "receita")
        .sort((a, b) => b.competence_date.localeCompare(a.competence_date)),
    [competenceTransactions],
  );

  // Aggregate installments of the same sale (series_id) into ONE line.
  // For parcelled sales, original_amount is stored on every installment as the
  // TOTAL sale value, and amount is the installment slice. So per-row fee is
  // wildly wrong — must group by series before computing gross/fee/net.
  const lines = useMemo(() => {
    type Group = { items: Tx[] };
    const groups = new Map<string, Group>();
    receitas.forEach((t) => {
      const key = t.series_id ? `s:${t.series_id}` : `t:${t.id}`;
      const g = groups.get(key) ?? { items: [] };
      g.items.push(t);
      groups.set(key, g);
    });

    return Array.from(groups.values()).map(({ items }) => {
      // Order by installment number so "first" is parcel 1
      const sorted = [...items].sort(
        (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
      );
      const first = sorted[0];
      const isSeries = !!first.series_id && items.length > 1;
      const totalParcels = first.installments_total ?? items.length;

      const net = r2(items.reduce((acc, t) => acc + (Number(t.amount) || 0), 0));
      // For a series, original_amount is the same total on every installment.
      // For a single row, original_amount is that row's gross.
      const grossCandidates = items
        .map((t) => (t.original_amount != null ? Number(t.original_amount) : 0))
        .filter((n) => n > 0);
      const rawGross = isSeries
        ? (grossCandidates.length > 0 ? Math.max(...grossCandidates) : 0)
        : (grossCandidates[0] ?? 0);
      const hasGross = rawGross > 0 && rawGross >= net - 0.01;
      const gross = hasGross ? r2(rawGross) : net;
      const fee = hasGross ? r2(Math.max(0, gross - net)) : 0;

      const paidCount = items.filter((t) => t.status === "Pago").length;
      const aggStatus =
        paidCount === items.length ? "Pago" : paidCount === 0 ? "Pendente" : "Parcial";

      const tx: Tx = {
        ...first,
        description: isSeries ? `${first.description} (${totalParcels}x)` : first.description,
        amount: net,
        original_amount: hasGross ? gross : null,
        status: aggStatus,
      };
      return { tx, gross, net, fee, hasGross, isSeries, parcels: totalParcels };
    }).sort((a, b) => b.tx.competence_date.localeCompare(a.tx.competence_date));
  }, [receitas]);


  const hasAnyMdr = lines.some((l) => l.hasGross);

  const totals = useMemo(() => {
    let gross = 0,
      fee = 0,
      net = 0;
    lines.forEach((l) => {
      gross += l.gross;
      fee += l.fee;
      net += l.net;
    });
    return { gross: r2(gross), fee: r2(fee), net: r2(net) };
  }, [lines]);

  const count = lines.length;
  const avgGross = count > 0 ? totals.gross / count : 0;
  const mdrPercent = totals.gross > 0 ? (totals.fee / totals.gross) * 100 : 0;
  const delta =
    prevTotal !== undefined && prevTotal > 0
      ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
      : null;

  const groupBy = (getKey: (l: (typeof lines)[number]) => string): Row[] => {
    const map = new Map<string, Row>();
    lines.forEach((l) => {
      const key = getKey(l);
      const cur = map.get(key) ?? { label: key, gross: 0, fee: 0, net: 0, count: 0 };
      cur.gross += l.gross;
      cur.fee += l.fee;
      cur.net += l.net;
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, gross: r2(r.gross), fee: r2(r.fee), net: r2(r.net) }))
      .sort((a, b) => b.gross - a.gross);
  };

  const byMonth = useMemo(
    () =>
      groupBy((l) => l.tx.competence_date.slice(0, 7))
        .map((r) => ({
          ...r,
          label: format(parseISO(`${r.label}-01`), "MMM/yyyy", { locale: ptBR }),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [lines],
  );

  const byCategory = useMemo(
    () => groupBy((l) => resolveCategory(l.tx.category)),
    [lines, categoryNameResolver],
  );

  const byContact = useMemo(
    () => groupBy((l) => l.tx.contact_name || "Sem contato"),
    [lines],
  );

  const paginated = useMemo(
    () => lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [lines, page],
  );
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary text-white flex items-center justify-center shadow-lg">
              <DollarSign className="h-4 w-4" />
            </div>
            Faturamento por competência
          </DialogTitle>
          <DialogDescription>
            Vendas/receitas com competência entre{" "}
            <span className="font-medium text-foreground">{formatDate(dateFrom)}</span> e{" "}
            <span className="font-medium text-foreground">{formatDate(dateTo)}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Bruto</p>
            <p className="text-lg font-bold font-display">{formatCurrency(totals.gross)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Ticket médio {formatCurrency(avgGross)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">MDR (taxas)</p>
            <p className="text-lg font-bold font-display text-destructive">
              -{formatCurrency(totals.fee)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mdrPercent.toFixed(2)}% efetivo
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Líquido</p>
            <p className="text-lg font-bold font-display text-success">
              {formatCurrency(totals.net)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {count} {count === 1 ? "venda" : "vendas"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">vs anterior</p>
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
            {prevTotal !== undefined && prevTotal > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Ant. {formatCurrency(prevTotal)}
              </p>
            )}
          </div>
        </div>

        <Tabs defaultValue="lista" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="mes">Por mês</TabsTrigger>
            <TabsTrigger value="categoria">Por categoria</TabsTrigger>
            <TabsTrigger value="contato">Por cliente/contato</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-[45vh] pr-2">
              {paginated.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma receita encontrada para esse período.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Competência</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Pagamento</th>
                      <th className="text-left py-2 pr-3">Descrição</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Contato</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Categoria</th>
                      {hasAnyMdr && <th className="text-right py-2 pr-3">Bruto</th>}
                      {hasAnyMdr && <th className="text-right py-2 pr-3">MDR</th>}
                      <th className="text-right py-2">{hasAnyMdr ? "Líquido" : "Valor"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((l) => {
                      const t = l.tx;
                      return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-3 font-mono text-xs">
                            {formatDate(t.competence_date)}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs hidden md:table-cell text-muted-foreground">
                            {formatDate(t.payment_date)}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[240px]">{t.description}</span>
                              {t.status === "Pendente" && (
                                <Badge variant="outline" className="text-[9px]">
                                  Pendente
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                            {t.contact_name || "—"}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                            {resolveCategory(t.category)}
                          </td>
                          {hasAnyMdr && (
                            <td className="py-2 pr-3 text-right font-mono text-xs">
                              {l.hasGross ? formatCurrency(l.gross) : "—"}
                            </td>
                          )}
                          {hasAnyMdr && (
                            <td className="py-2 pr-3 text-right font-mono text-xs text-destructive">
                              {l.fee > 0 ? `-${formatCurrency(l.fee)}` : "—"}
                            </td>
                          )}
                          <td className="py-2 text-right font-mono font-medium text-success">
                            {formatCurrency(l.net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
            <GroupTable rows={byMonth} totalGross={totals.gross} hasAnyMdr={hasAnyMdr} />
          </TabsContent>
          <TabsContent value="categoria" className="mt-3">
            <GroupTable rows={byCategory} totalGross={totals.gross} hasAnyMdr={hasAnyMdr} />
          </TabsContent>
          <TabsContent value="contato" className="mt-3">
            <GroupTable rows={byContact} totalGross={totals.gross} hasAnyMdr={hasAnyMdr} />
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

function GroupTable({
  rows,
  totalGross,
  hasAnyMdr,
}: {
  rows: Row[];
  totalGross: number;
  hasAnyMdr: boolean;
}) {
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
            <th className="text-right py-2 pr-3">Qtd</th>
            <th className="text-right py-2 pr-3">% Bruto</th>
            <th className="text-right py-2 pr-3">Bruto</th>
            {hasAnyMdr && <th className="text-right py-2 pr-3">MDR</th>}
            {hasAnyMdr && <th className="text-right py-2">Líquido</th>}
            {!hasAnyMdr && <th className="text-right py-2">Valor</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = totalGross > 0 ? (r.gross / totalGross) * 100 : 0;
            return (
              <tr key={r.label} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-3 truncate max-w-[260px]">{r.label}</td>
                <td className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">
                  {r.count}
                </td>
                <td className="py-2 pr-3 text-right text-muted-foreground font-mono text-xs">
                  {pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.gross)}</td>
                {hasAnyMdr && (
                  <td className="py-2 pr-3 text-right font-mono text-destructive text-xs">
                    {r.fee > 0 ? `-${formatCurrency(r.fee)}` : "—"}
                  </td>
                )}
                <td className="py-2 text-right font-mono font-medium text-success">
                  {formatCurrency(r.net)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

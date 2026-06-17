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
  type: "receita" | "despesa";
  status: string;
  competence_date: string;
  payment_date: string;
  category: string;
  contact_name: string | null;
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

  const receitas = useMemo(
    () =>
      competenceTransactions
        .filter((t) => t.type === "receita")
        .sort((a, b) => b.competence_date.localeCompare(a.competence_date)),
    [competenceTransactions],
  );

  const count = receitas.length;
  const avg = count > 0 ? total / count : 0;
  const delta =
    prevTotal !== undefined && prevTotal > 0
      ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
      : null;

  // Agrupamentos
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    receitas.forEach((t) => {
      const key = t.competence_date.slice(0, 7); // YYYY-MM
      map.set(key, (map.get(key) || 0) + Number(t.amount));
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
      map.set(name, (map.get(name) || 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [receitas, categoryNameResolver]);

  const byContact = useMemo(() => {
    const map = new Map<string, number>();
    receitas.forEach((t) => {
      const name = t.contact_name || "Sem contato";
      map.set(name, (map.get(name) || 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [receitas]);

  const paginated = useMemo(
    () => receitas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [receitas, page],
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Total</p>
            <p className="text-lg font-bold font-display">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Lançamentos</p>
            <p className="text-lg font-bold font-display">{count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Ticket médio</p>
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
            <TabsTrigger value="lista">Lista</TabsTrigger>
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
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Competência</th>
                      <th className="text-left py-2 pr-3">Descrição</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Contato</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Categoria</th>
                      <th className="text-right py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-mono text-xs">{formatDate(t.competence_date)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[260px]">{t.description}</span>
                            {t.status === "Pendente" && (
                              <Badge variant="outline" className="text-[9px]">Pendente</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                          {t.contact_name || "—"}
                        </td>
                        <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                          {categoryNameResolver ? categoryNameResolver(t.category) : t.category}
                        </td>
                        <td className="py-2 text-right font-mono font-medium text-success">
                          {formatCurrency(Number(t.amount))}
                        </td>
                      </tr>
                    ))}
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

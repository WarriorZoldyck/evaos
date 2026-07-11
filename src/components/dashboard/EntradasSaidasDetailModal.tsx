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
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

type Tx = {
  id: string;
  description: string;
  amount: number | string;
  type: "receita" | "despesa";
  status: string;
  competence_date: string;
  payment_date: string | null;
  category: string;
  contact_name: string | null;
  series_id?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
  payment_method?: string | null;
  card_terminal_id?: string | null;
  credit_card_id?: string | null;
  bank_account_id?: string | null;
  wallet_id?: string | null;
};

type PaymentKind =
  | "credito"
  | "debito"
  | "boleto"
  | "pix"
  | "dinheiro"
  | "transferencia"
  | "outros";

const KIND_LABEL: Record<PaymentKind, string> = {
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outros: "Outros",
};

function normalizePM(pm?: string | null): string {
  return (pm ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

function classifyItem(t: Tx): PaymentKind {
  const pm = normalizePM(t.payment_method);
  if (["debito", "cartaodebito", "debitcard"].includes(pm)) return "debito";
  if (["credito", "cartaocredito", "creditcard", "cartao"].includes(pm)) return "credito";
  if (!!t.card_terminal_id || !!t.credit_card_id) return "credito";
  if (pm.includes("boleto")) return "boleto";
  if (pm.includes("pix")) return "pix";
  if (pm.includes("dinheiro") || pm === "cash" || pm.includes("especie")) return "dinheiro";
  if (pm.includes("transferencia") || pm === "ted" || pm === "doc") return "transferencia";
  return "outros";
}

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

interface AccountRef {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "entradas" | "saidas";
  transactions: Tx[]; // dashboard transactions (by payment_date, current context/period)
  total: number;
  prevTotal?: number;
  dateFrom: string;
  dateTo: string;
  categoryNameResolver?: (id: string) => string;
  bankAccounts?: AccountRef[];
  wallets?: AccountRef[];
  creditCards?: AccountRef[];
}

export function EntradasSaidasDetailModal({
  open,
  onOpenChange,
  mode,
  transactions,
  total,
  prevTotal,
  dateFrom,
  dateTo,
  categoryNameResolver,
  bankAccounts = [],
  wallets = [],
  creditCards = [],
}: Props) {
  const navigate = useNavigate();
  const [paymentFilter, setPaymentFilter] = useState<PaymentKind | "all">("all");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 50;

  const isEntradas = mode === "entradas";
  const targetType: "receita" | "despesa" = isEntradas ? "receita" : "despesa";
  const accentClass = isEntradas ? "text-success" : "text-destructive";
  const gradientClass = isEntradas ? "bg-gradient-success" : "bg-gradient-destructive";
  const Icon = isEntradas ? TrendingUp : TrendingDown;
  const title = isEntradas ? "Entradas pagas no período" : "Saídas pagas no período";

  const resolveCategory = (id: string) =>
    categoryNameResolver ? categoryNameResolver(id) : id || "Sem categoria";

  // Rows: paid transactions of the target type. Group by series_id (installments = 1 line).
  const lines = useMemo(() => {
    const paid = transactions.filter(
      (t) => t.type === targetType && t.status === "Pago",
    );
    type Group = { items: Tx[] };
    const groups = new Map<string, Group>();
    paid.forEach((t) => {
      const key = t.series_id ? `s:${t.series_id}` : `t:${t.id}`;
      const g = groups.get(key) ?? { items: [] };
      g.items.push(t);
      groups.set(key, g);
    });
    return Array.from(groups.values())
      .map(({ items }) => {
        const sorted = [...items].sort(
          (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
        );
        const first = sorted[0];
        const isSeries = !!first.series_id && items.length > 1;
        const totalParcels = first.installments_total ?? items.length;
        const amount = items.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const kind = classifyItem(first);
        return {
          key: first.series_id ? `s:${first.series_id}` : `t:${first.id}`,
          first,
          items: sorted,
          isSeries,
          parcels: totalParcels,
          amount,
          kind,
        };
      })
      .sort((a, b) => (b.first.payment_date ?? "").localeCompare(a.first.payment_date ?? ""));
  }, [transactions, targetType]);

  const availableKinds = useMemo(() => {
    const s = new Set<PaymentKind>();
    lines.forEach((l) => l.items.forEach((t) => s.add(classifyItem(t))));
    return s;
  }, [lines]);

  const filtered = useMemo(
    () => (paymentFilter === "all" ? lines : lines.filter((l) => l.items.some((t) => classifyItem(t) === paymentFilter))),
    [lines, paymentFilter],
  );

  const totals = useMemo(() => {
    const sum = filtered.reduce((acc, l) => acc + l.amount, 0);
    return { sum: Math.round((sum + Number.EPSILON) * 100) / 100 };
  }, [filtered]);

  const avg = filtered.length > 0 ? totals.sum / filtered.length : 0;
  const delta =
    prevTotal !== undefined && prevTotal > 0
      ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
      : null;

  const paginated = showAll ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const goToLancamentos = () => {
    const sp = new URLSearchParams();
    sp.set("dateFrom", dateFrom);
    sp.set("dateTo", dateTo);
    sp.set("type", targetType);
    sp.set("status", "Pago");
    navigate(`/lancamentos?${sp.toString()}`);
  };

  const exportCsv = () => {
    const header = [
      "pagamento", "competencia", "serie", "parcela", "contato", "descricao",
      "categoria", "forma", "status", "valor",
    ];
    const rows: string[][] = [header];
    filtered.forEach((l) => {
      l.items.forEach((it) => {
        rows.push([
          it.payment_date ?? "",
          it.competence_date ?? "",
          it.series_id ?? "",
          `${it.installment_number ?? 1}/${it.installments_total ?? 1}`,
          it.contact_name ?? "",
          it.description ?? "",
          resolveCategory(it.category),
          KIND_LABEL[classifyItem(it)],
          it.status,
          (Number(it.amount) || 0).toFixed(2).replace(".", ","),
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isEntradas ? "entradas" : "saidas"}-${dateFrom}_a_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1200px] max-h-[92vh] p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className={`h-9 w-9 rounded-xl ${gradientClass} text-white flex items-center justify-center shadow-lg`}>
              <Icon className="h-4 w-4" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription>
            {isEntradas ? "Receitas" : "Despesas"} com pagamento entre{" "}
            <span className="font-medium text-foreground">{formatDate(dateFrom)}</span> e{" "}
            <span className="font-medium text-foreground">{formatDate(dateTo)}</span>.{" "}
            <span className="text-muted-foreground">
              {lines.length} lançamento(s) após agrupar parcelas.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Total</p>
            <p className={`text-lg font-bold font-display ${accentClass}`}>{formatCurrency(totals.sum)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"} · média {formatCurrency(avg)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">vs período anterior</p>
            <p
              className={`text-lg font-bold font-display ${
                delta === null
                  ? "text-muted-foreground"
                  : (isEntradas ? delta >= 0 : delta <= 0)
                    ? "text-success"
                    : "text-destructive"
              }`}
            >
              {delta === null ? "—" : `${delta >= 0 ? "↗" : "↘"} ${Math.abs(delta).toFixed(1)}%`}
            </p>
            {prevTotal !== undefined && prevTotal > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Ant. {formatCurrency(prevTotal)}</p>
            )}
          </div>
          <div className="rounded-lg border p-3 flex flex-col justify-between">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Ações</p>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={exportCsv}>
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros forma */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase text-muted-foreground tracking-wide">Forma:</span>
          <div className="flex flex-wrap gap-1">
            {(["all", "credito", "debito", "boleto", "pix", "dinheiro", "transferencia", "outros"] as const)
              .filter((k) => k === "all" || availableKinds.has(k as PaymentKind))
              .map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={paymentFilter === k ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => { setPaymentFilter(k as any); setPage(1); }}
                >
                  {k === "all" ? "Todas" : KIND_LABEL[k as PaymentKind]}
                </Button>
              ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-hidden flex flex-col mt-3">
          <div className="overflow-auto h-[50vh] pr-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhum lançamento encontrado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Contato</th>
                    <th className="text-left py-2 pr-3">Descrição</th>
                    <th className="text-left py-2 pr-3 hidden md:table-cell">Pagamento</th>
                    <th className="text-left py-2 pr-3 hidden lg:table-cell">Categoria</th>
                    <th className="text-left py-2 pr-3 hidden md:table-cell">Forma</th>
                    <th className="text-right py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((l) => {
                    const t = l.first;
                    const label = t.contact_name?.trim() || t.description?.trim() || "—";
                    return (
                      <tr key={l.key} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-medium truncate max-w-[220px]">{label}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[320px] text-muted-foreground">
                              {l.isSeries ? `${t.description} (${l.parcels}x)` : t.description}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs hidden md:table-cell text-muted-foreground">
                          {formatDate(t.payment_date)}
                        </td>
                        <td className="py-2 pr-3 hidden lg:table-cell text-muted-foreground truncate max-w-[200px]">
                          {resolveCategory(t.category)}
                        </td>
                        <td className="py-2 pr-3 hidden md:table-cell text-xs">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {KIND_LABEL[l.kind]}
                          </Badge>
                        </td>
                        <td className={`py-2 text-right font-mono font-medium ${accentClass}`}>
                          {formatCurrency(l.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>{filtered.length} lançamento(s)</span>
              {!showAll ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <span>{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Próxima
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAll(true)}>
                    Mostrar todos
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setShowAll(false); setPage(1); }}>
                  Paginar
                </Button>
              )}
            </div>
          )}
        </div>

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

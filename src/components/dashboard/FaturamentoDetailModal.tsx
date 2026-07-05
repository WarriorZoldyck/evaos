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
  card_terminal_id?: string | null;
  payment_method?: string | null;
};

type PaymentKind =
  | "credito"
  | "debito"
  | "boleto"
  | "pix"
  | "dinheiro"
  | "transferencia"
  | "outros";

const CARD_KINDS: PaymentKind[] = ["credito", "debito"];

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
  if (!!t.card_terminal_id) return "credito"; // terminal sem PM explícito → crédito
  if (pm.includes("boleto")) return "boleto";
  if (pm.includes("pix")) return "pix";
  if (pm.includes("dinheiro") || pm === "cash" || pm.includes("especie")) return "dinheiro";
  if (pm.includes("transferencia") || pm === "ted" || pm === "doc") return "transferencia";
  return "outros";
}

function isCardItem(t: Tx): boolean {
  return CARD_KINDS.includes(classifyItem(t));
}

function saleHasKind(items: Tx[], kind: PaymentKind): boolean {
  return items.some((t) => classifyItem(t) === kind);
}

// Kind primário da venda = maior soma de amount por classificação;
// se houver mistura relevante (cartão + não-cartão), retorna "outros" (Misto).
function primaryKind(items: Tx[]): PaymentKind {
  const totals = new Map<PaymentKind, number>();
  items.forEach((t) => {
    const k = classifyItem(t);
    totals.set(k, (totals.get(k) ?? 0) + (Number(t.amount) || 0));
  });
  let best: PaymentKind = "outros";
  let bestVal = -1;
  totals.forEach((v, k) => {
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  });
  return best;
}


const KIND_LABEL: Record<PaymentKind, string> = {
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outros: "Outros",
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

type SaleLine = {
  tx: Tx;
  gross: number;
  net: number;
  fee: number;
  hasGross: boolean;
  isSeries: boolean;
  parcels: number;
  kind: PaymentKind;
  items: Tx[];
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
  const [paymentFilter, setPaymentFilter] = useState<PaymentKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Pago" | "Pendente" | "Parcial">("all");
  const [showDupOnly, setShowDupOnly] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleLine | null>(null);
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
  const lines = useMemo<SaleLine[]>(() => {
    type Group = { items: Tx[] };
    const groups = new Map<string, Group>();
    receitas.forEach((t) => {
      const key = t.series_id ? `s:${t.series_id}` : `t:${t.id}`;
      const g = groups.get(key) ?? { items: [] };
      g.items.push(t);
      groups.set(key, g);
    });

    return Array.from(groups.values())
      .map<SaleLine>(({ items }) => {
        const sorted = [...items].sort(
          (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
        );
        const first = sorted[0];
        const isSeries = !!first.series_id && items.length > 1;
        const totalParcels = first.installments_total ?? items.length;
        const kind = primaryKind(items);

        // Per-item computation: MDR só onde a parcela é cartão.
        let gross = 0;
        let fee = 0;
        let net = 0;
        items.forEach((t) => {
          const amt = Number(t.amount) || 0;
          const oa = Number(t.original_amount) || 0;
          if (isCardItem(t) && oa > amt) {
            gross += oa;
            fee += oa - amt;
            net += amt;
          } else {
            gross += amt;
            net += amt;
          }
        });
        gross = r2(gross);
        fee = r2(fee);
        net = r2(net);
        const hasGross = fee > 0;

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
        return { tx, gross, net, fee, hasGross, isSeries, parcels: totalParcels, kind, items: sorted };
      })
      .sort((a, b) => b.tx.competence_date.localeCompare(a.tx.competence_date));
  }, [receitas]);

  // Duplicate detection: same normalized client + same gross + competência ±3 days
  const dupIds = useMemo(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const dayIndex = (iso: string) => Math.floor(new Date(iso + "T00:00:00").getTime() / 86400000);
    const flagged = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i], b = lines[j];
        const ca = norm(a.tx.contact_name || a.tx.description || "");
        const cb = norm(b.tx.contact_name || b.tx.description || "");
        if (!ca || ca !== cb) continue;
        if (Math.abs(a.gross - b.gross) > 0.01) continue;
        if (Math.abs(dayIndex(a.tx.competence_date) - dayIndex(b.tx.competence_date)) > 3) continue;
        flagged.add(a.tx.id);
        flagged.add(b.tx.id);
      }
    }
    return flagged;
  }, [lines]);

  const preFiltered = useMemo(() => {
    let out = paymentFilter === "all" ? lines : lines.filter((l) => saleHasKind(l.items, paymentFilter));
    if (statusFilter !== "all") out = out.filter((l) => l.tx.status === statusFilter);
    if (showDupOnly) out = out.filter((l) => dupIds.has(l.tx.id));
    return out;
  }, [lines, paymentFilter, statusFilter, showDupOnly, dupIds]);

  const filteredLines = preFiltered;

  const hasAnyMdr = filteredLines.some((l) => l.hasGross);

  const totals = useMemo(() => {
    let gross = 0, fee = 0, net = 0;
    filteredLines.forEach((l) => {
      gross += l.gross;
      fee += l.fee;
      net += l.net;
    });
    return { gross: r2(gross), fee: r2(fee), net: r2(net) };
  }, [filteredLines]);

  // Audit stats: parcelas / pagas / pendentes / confer
  const audit = useMemo(() => {
    let parcels = 0, paid = 0, pending = 0, partial = 0;
    filteredLines.forEach((l) => {
      parcels += l.items.length;
      l.items.forEach((it) => {
        if (it.status === "Pago") paid++;
        else if (it.status === "Pendente") pending++;
        else partial++;
      });
    });
    const diff = r2(totals.gross - totals.fee - totals.net);
    return { parcels, paid, pending, partial, diff, ok: Math.abs(diff) < 0.02 };
  }, [filteredLines, totals]);

  const count = filteredLines.length;
  const avgGross = count > 0 ? totals.gross / count : 0;
  const mdrBase = filteredLines
    .filter((l) => l.hasGross)
    .reduce((acc, l) => acc + l.gross, 0);
  const mdrPercent = mdrBase > 0 ? (totals.fee / mdrBase) * 100 : 0;
  const delta =
    prevTotal !== undefined && prevTotal > 0
      ? ((total - prevTotal) / Math.abs(prevTotal)) * 100
      : null;

  const exportCsv = () => {
    const header = [
      "competencia","pagamento","serie","parcela","cliente","contato","descricao",
      "categoria","forma","status","bruto","mdr","liquido",
    ];
    const rows: string[][] = [header];
    filteredLines.forEach((l) => {
      const cliente = l.tx.contact_name?.trim() || l.tx.description?.trim() || "Sem cliente";
      l.items.forEach((it) => {
        const amt = Number(it.amount) || 0;
        const oa = Number(it.original_amount) || 0;
        const itKind = classifyItem(it);
        const isCard = isCardItem(it);
        const g = isCard && oa > amt ? oa : amt;
        const f = isCard && oa > amt ? oa - amt : 0;
        rows.push([
          it.competence_date,
          it.payment_date ?? "",
          it.series_id ?? "",
          `${it.installment_number ?? 1}/${it.installments_total ?? 1}`,
          cliente,
          it.contact_name ?? "",
          it.description ?? "",
          resolveCategory(it.category),
          KIND_LABEL[itKind],
          it.status,
          r2(g).toFixed(2).replace(".", ","),
          r2(f).toFixed(2).replace(".", ","),
          r2(amt).toFixed(2).replace(".", ","),
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
    a.download = `receitas-${dateFrom}_a_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupBy = (getKey: (l: SaleLine) => string): Row[] => {
    const map = new Map<string, Row>();
    filteredLines.forEach((l) => {
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
    [filteredLines],
  );

  const byCategory = useMemo(
    () => groupBy((l) => resolveCategory(l.tx.category)),
    [filteredLines, categoryNameResolver],
  );

  const byContact = useMemo(
    () => groupBy((l) => (l.tx.contact_name?.trim() || l.tx.description?.trim() || "Sem cliente")),
    [filteredLines],
  );

  const paginated = useMemo(
    () => filteredLines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredLines, page],
  );
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const availableKinds = useMemo(() => {
    const set = new Set<PaymentKind>();
    lines.forEach((l) => l.items.forEach((t) => set.add(classifyItem(t))));
    return set;
  }, [lines]);

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
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[92vh] p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col">
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

        {/* Painel de auditoria */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span><span className="text-muted-foreground">Vendas:</span> <b>{count}</b></span>
          <span><span className="text-muted-foreground">Parcelas:</span> <b>{audit.parcels}</b></span>
          <span className="text-success">Pagas: <b>{audit.paid}</b></span>
          <span className="text-amber-600 dark:text-amber-400">Pendentes: <b>{audit.pending}</b></span>
          {audit.partial > 0 && <span>Parcial: <b>{audit.partial}</b></span>}
          <span className="text-muted-foreground">·</span>
          <span>Σ Bruto <b>{formatCurrency(totals.gross)}</b></span>
          <span className="text-destructive">− MDR <b>{formatCurrency(totals.fee)}</b></span>
          <span className="text-success">= Líquido <b>{formatCurrency(totals.net)}</b></span>
          <Badge variant={audit.ok ? "outline" : "destructive"} className="text-[10px]">
            {audit.ok ? "✓ Confere" : `Δ ${formatCurrency(audit.diff)}`}
          </Badge>
          {dupIds.size > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400">
              {dupIds.size} possível(is) duplicata(s)
            </Badge>
          )}
          <div className="ml-auto flex gap-1">
            {dupIds.size > 0 && (
              <Button
                size="sm"
                variant={showDupOnly ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => { setShowDupOnly((v) => !v); setPage(1); }}
              >
                {showDupOnly ? "Mostrar todos" : "Só duplicatas"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={exportCsv}>
              Exportar CSV
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Forma:
            </span>
            <div className="flex flex-wrap gap-1">
              {(["all", "credito", "debito", "boleto", "pix", "dinheiro", "transferencia", "outros"] as const)
                .filter((k) => k === "all" || availableKinds.has(k as PaymentKind))
                .map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={paymentFilter === k ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setPaymentFilter(k as PaymentKind | "all");
                      setPage(1);
                    }}
                  >
                    {k === "all" ? "Todas" : KIND_LABEL[k as PaymentKind]}
                  </Button>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Status:
            </span>
            <div className="flex flex-wrap gap-1">
              {(["all", "Pago", "Pendente", "Parcial"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                >
                  {s === "all" ? "Todos" : s}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="lista" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="mes">Por mês</TabsTrigger>
            <TabsTrigger value="categoria">Por categoria</TabsTrigger>
            <TabsTrigger value="contato">Por cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="flex-1 overflow-hidden mt-3">
            <div className="overflow-auto h-[45vh] pr-2">
              {paginated.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma receita encontrada para esse período.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Cliente</th>
                      <th className="text-left py-2 pr-3">Descrição</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Competência</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Pagamento</th>
                      <th className="text-left py-2 pr-3 hidden lg:table-cell">Categoria</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Forma</th>
                      {hasAnyMdr && <th className="text-right py-2 pr-3">Bruto</th>}
                      {hasAnyMdr && <th className="text-right py-2 pr-3">MDR</th>}
                      <th className="text-right py-2">{hasAnyMdr ? "Líquido" : "Valor"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((l) => {
                      const t = l.tx;
                      const clienteLabel = t.contact_name?.trim() || t.description?.trim() || "Sem cliente";
                      return (
                        <tr
                          key={t.id}
                          className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${dupIds.has(t.id) ? "bg-amber-500/5" : ""}`}
                          onClick={() => setSelectedSale(l)}
                        >
                          <td className="py-2 pr-3 font-medium truncate max-w-[240px]">
                            {clienteLabel}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[320px] text-muted-foreground">
                                {t.description}
                              </span>
                              {(t.status === "Pendente" || t.status === "Parcial") && (
                                <Badge variant="outline" className="text-[9px]">
                                  {t.status}
                                </Badge>
                              )}
                              {dupIds.has(t.id) && (
                                <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600 dark:text-amber-400">
                                  Possível duplicata
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs hidden md:table-cell">
                            {formatDate(t.competence_date)}
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
                          {hasAnyMdr && (
                            <td className="py-2 pr-3 text-right font-mono text-xs">
                              {formatCurrency(l.gross)}
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
            </div>
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
      <SaleDetailDialog
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        resolveCategory={resolveCategory}
        onOpenInLancamentos={(sale) => {
          const sp = new URLSearchParams();
          sp.set("type", "receita");
          if (sale.tx.series_id) {
            sp.set("series_id", sale.tx.series_id);
          } else {
            sp.set("dateFrom", sale.tx.competence_date);
            sp.set("dateTo", sale.tx.competence_date);
            sp.set("dateField", "competence_date");
          }
          navigate(`/lancamentos?${sp.toString()}`);
        }}
      />
    </Dialog>
  );
}

function SaleDetailDialog({
  sale,
  onClose,
  resolveCategory,
  onOpenInLancamentos,
}: {
  sale: SaleLine | null;
  onClose: () => void;
  resolveCategory: (id: string) => string;
  onOpenInLancamentos: (sale: SaleLine) => void;
}) {
  const open = !!sale;
  if (!sale) {
    return (
      <Dialog open={false} onOpenChange={(v) => !v && onClose()}>
        <DialogContent />
      </Dialog>
    );
  }
  const { tx, items, gross, net, fee, hasGross, isSeries, parcels, kind } = sale;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">{tx.description}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>
                <span className="text-muted-foreground">Contato:</span>{" "}
                <span className="text-foreground">{tx.contact_name || "—"}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Categoria:</span>{" "}
                <span className="text-foreground">{resolveCategory(tx.category)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Forma de pagamento:</span>{" "}
                <span className="text-foreground">{KIND_LABEL[kind]}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant="outline" className="text-[9px] ml-1">
                  {tx.status}
                </Badge>
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className={`grid gap-2 ${hasGross ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
          {hasGross && (
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Bruto</p>
              <p className="text-base font-bold font-display">{formatCurrency(gross)}</p>
            </div>
          )}
          {hasGross && (
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">MDR</p>
              <p className="text-base font-bold font-display text-destructive">
                -{formatCurrency(fee)}
              </p>
            </div>
          )}
          <div className="rounded-lg border p-2">
            <p className="text-[10px] uppercase text-muted-foreground">
              {hasGross ? "Líquido" : "Valor"}
            </p>
            <p className="text-base font-bold font-display text-success">{formatCurrency(net)}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Parcelas</p>
            <p className="text-base font-bold font-display">{parcels}</p>
          </div>
        </div>

        {isSeries && (
          <ScrollArea className="h-[40vh] pr-2 mt-2">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Competência</th>
                  <th className="text-left py-2 pr-3">Pagamento</th>
                  <th className="text-left py-2 pr-3">Forma</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-right py-2 pr-3">MDR</th>
                  <th className="text-right py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const itKind = classifyItem(it);
                  const amt = Number(it.amount) || 0;
                  const oa = Number(it.original_amount) || 0;
                  const itFee = isCardItem(it) && oa > amt ? r2(oa - amt) : 0;
                  return (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {it.installment_number ?? "—"}/{parcels}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {formatDate(it.competence_date)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                        {formatDate(it.payment_date)}
                      </td>
                      <td className="py-2 pr-3 text-xs">{KIND_LABEL[itKind]}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${it.status === "Pago" ? "text-success" : ""}`}
                        >
                          {it.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs text-destructive">
                        {itFee > 0 ? `-${formatCurrency(itFee)}` : "—"}
                      </td>
                      <td className="py-2 text-right font-mono font-medium">
                        {formatCurrency(amt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenInLancamentos(sale)} className="gap-2">
            Abrir na tela de Lançamentos
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

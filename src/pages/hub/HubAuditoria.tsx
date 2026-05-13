import { useMemo, useState } from "react";
import {
  useHubAuditLog,
  fetchAuditForExport,
  AUDIT_EXPORT_MAX,
  type AuditEntry,
} from "@/hooks/useHubAuditLog";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, FileText, RefreshCw, ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

function fmtDate(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }); }
  catch { return iso; }
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    impersonation_start: "Iniciou impersonação",
    impersonation_exit: "Saiu da impersonação",
    transaction_create: "Criou lançamento",
    transaction_update: "Editou lançamento",
    transaction_delete: "Excluiu lançamento",
    transaction_bulk_create: "Criou lançamentos em lote",
    transaction_bulk_delete: "Excluiu lançamentos em lote",
    account_create: "Criou conta",
    account_update: "Editou conta",
    account_delete: "Excluiu conta",
    category_create: "Criou categoria",
    category_update: "Editou categoria",
    category_delete: "Excluiu categoria",
    contact_create: "Criou contato",
    contact_update: "Editou contato",
    contact_delete: "Excluiu contato",
    goal_create: "Criou meta",
    goal_update: "Editou meta",
    goal_delete: "Excluiu meta",
  };
  return map[a] ?? a;
}

function downloadCSV(rows: AuditEntry[]) {
  const headers = ["Data", "Usuário", "E-mail", "Ação", "Recurso", "ID Recurso", "Detalhes"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => [
      fmtDate(r.created_at),
      r.actor_name ?? "—",
      r.actor_email ?? "—",
      actionLabel(r.action),
      r.resource_type ?? "",
      r.resource_id ?? "",
      r.payload ? JSON.stringify(r.payload) : "",
    ].map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-hub-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPDF(rows: AuditEntry[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 32;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Auditoria — EVA Hub", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, y);
  y += 14;
  doc.text(`Total de eventos: ${rows.length}`, margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Data", margin, y);
  doc.text("Usuário", margin + 110, y);
  doc.text("Ação", margin + 260, y);
  doc.text("Recurso", margin + 420, y);
  y += 4;
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  rows.forEach((r) => {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(fmtDate(r.created_at), margin, y);
    doc.text(String(r.actor_name ?? r.actor_email ?? "—").slice(0, 28), margin + 110, y);
    doc.text(actionLabel(r.action).slice(0, 30), margin + 260, y);
    doc.text(String(r.resource_type ?? "—").slice(0, 22), margin + 420, y);
    y += 14;
  });

  doc.save(`auditoria-hub-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function HubAuditoria() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const { entries, totalCount, pageSize, loading, refetch } = useHubAuditLog({ page });
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (!q) return true;
      return [e.actor_name, e.actor_email, e.action, e.resource_type, e.resource_id]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [entries, search, actionFilter]);

  const handleExport = async (kind: "csv" | "pdf") => {
    if (!user) return;
    setExporting(kind);
    try {
      const { rows, truncated } = await fetchAuditForExport(user.id);
      if (!rows.length) {
        toast.info("Nenhum evento para exportar.");
        return;
      }
      if (truncated) {
        toast.warning(
          `Exportando os ${AUDIT_EXPORT_MAX.toLocaleString("pt-BR")} eventos mais recentes (limite de exportação).`,
        );
      }
      if (kind === "csv") downloadCSV(rows);
      else await downloadPDF(rows);
      toast.success(`Exportado ${rows.length.toLocaleString("pt-BR")} eventos em ${kind.toUpperCase()}.`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao exportar auditoria.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico de ações realizadas por membros em modo impersonação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-2 hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => handleExport("csv")}
            disabled={!totalCount || !!exporting}
          >
            {exporting === "csv"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!totalCount || !!exporting}
          >
            {exporting === "pdf"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileText className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros (página atual)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, ação, recurso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todas as ações</option>
            {actions.map((a) => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {totalCount === 0
                ? "Nenhum evento de auditoria registrado ainda."
                : "Nenhum evento encontrado nesta página com os filtros atuais."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDate(e.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{e.actor_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{e.actor_email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{actionLabel(e.action)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.resource_type ?? "—"}
                        {e.resource_id && (
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                            {e.resource_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                        {e.payload && Object.keys(e.payload).length
                          ? JSON.stringify(e.payload)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Página {page + 1} de {totalPages} • {totalCount.toLocaleString("pt-BR")} eventos no total
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Eventos são automaticamente removidos após 180 dias. Exportações limitam-se aos {AUDIT_EXPORT_MAX.toLocaleString("pt-BR")} mais recentes.
      </p>
    </div>
  );
}

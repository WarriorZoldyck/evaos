import { useState, useEffect, useCallback, Fragment } from "react";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ScrollText, Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AuditLog = {
  id: string;
  user_id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  source: string | null;
  created_at: string;
  actor_name?: string;
};

const ACTIONS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "Lançamento criado", variant: "default" },
  UPDATE: { label: "Lançamento editado", variant: "secondary" },
  DELETE: { label: "Lançamento excluído", variant: "destructive" },
  PAY: { label: "Pago", variant: "default" },
  UNPAY: { label: "Pagamento desfeito", variant: "outline" },
  AI_CREATE: { label: "Análise EVA criada", variant: "secondary" },
  AI_APPROVE: { label: "Análise EVA aprovada", variant: "default" },
  AI_REJECT: { label: "Análise EVA rejeitada", variant: "destructive" },
  AI_UPDATE: { label: "Análise EVA alterada", variant: "outline" },
  AI_DELETE: { label: "Análise EVA removida", variant: "destructive" },
  IMPORT: { label: "Extrato importado", variant: "default" },
};

const FIELD_LABELS: Record<string, string> = {
  description: "Descrição", amount: "Valor", status: "Status", category: "Categoria",
  subcategory: "Subcategoria", subcategory2: "Subcategoria 2", payment_date: "Pagamento",
  competence_date: "Competência", bank_account_id: "Conta", credit_card_id: "Cartão",
  wallet_id: "Carteira", company_id: "Contexto", contact_name: "Contato", notes: "Observações",
  supplier_id: "Fornecedor", client_id: "Cliente", payment_method: "Forma de pagamento",
};

const brl = (v: any) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export default function Historico() {
  const ownerId = useEffectiveUserId();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("transaction_audit_logs")
        .select("*", { count: "exact" })
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (action !== "all") q = q.eq("action", action);
      if (from) q = q.gte("created_at", `${from}T00:00:00`);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const s = search.trim().replace(/[,()]/g, " ");
      if (s) q = q.or(`new_data->>description.ilike.%${s}%,old_data->>description.ilike.%${s}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      setTotalCount(count ?? 0);
      const ids = Array.from(new Set<string>(((data || []) as any[]).map((r) => r.actor_id).filter(Boolean)));
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        profs?.forEach((p) => { names[p.id] = p.full_name || "Usuário"; });
      }
      setLogs((data || []).map((r: any) => ({ ...r, actor_name: (r.actor_id && names[r.actor_id]) || (r.source === "sistema" ? "Sistema / EVA" : "Usuário") })));
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [ownerId, page, action, from, to, search]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300);
    return () => clearTimeout(t);
  }, [fetchLogs]);

  useEffect(() => { setPage(0); }, [action, from, to, search]);

  const diff = (log: AuditLog) => {
    if (!log.old_data || !log.new_data) return [];
    return Object.keys(FIELD_LABELS)
      .filter((k) => JSON.stringify(log.old_data![k]) !== JSON.stringify(log.new_data![k]))
      .map((k) => ({ k, before: log.old_data![k], after: log.new_data![k] }));
  };

  const fmtVal = (k: string, v: any) => (v == null || v === "" ? "—" : k === "amount" ? brl(v) : String(v));
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            Histórico de Lançamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria de tudo que foi criado, editado, pago, importado ou aprovado na EVA.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Buscar movimentações</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="De" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="Até" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma movimentação encontrada. O histórico registra as ações a partir de agora.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const data = log.new_data ?? log.old_data;
                    const a = ACTIONS[log.action] ?? { label: log.action, variant: "outline" as const };
                    const changes = diff(log);
                    const expandable = changes.length > 0;
                    return (
                      <Fragment key={log.id}>
                        <TableRow className={expandable ? "cursor-pointer" : ""} onClick={() => expandable && setOpen(open === log.id ? null : log.id)}>
                          <TableCell>{expandable && <ChevronDown className={`h-4 w-4 transition-transform ${open === log.id ? "rotate-180" : ""}`} />}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{log.actor_name}</TableCell>
                          <TableCell><Badge variant={a.variant}>{a.label}</Badge></TableCell>
                          <TableCell className="text-sm max-w-[320px] truncate" title={data?.description}>{data?.description || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{brl(data?.amount)}</TableCell>
                        </TableRow>
                        {open === log.id && (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={5} className="bg-muted/40">
                              <div className="grid gap-1 text-xs">
                                {changes.map((c) => (
                                  <div key={c.k}>
                                    <span className="font-medium">{FIELD_LABELS[c.k]}:</span>{" "}
                                    <span className="text-muted-foreground line-through">{fmtVal(c.k, c.before)}</span>{" → "}
                                    <span>{fmtVal(c.k, c.after)}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Página {page + 1} de {totalPages} • {totalCount.toLocaleString("pt-BR")} eventos</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

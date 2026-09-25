import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AuditLog = {
  id: string;
  transaction_id: string;
  user_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
};

export default function Historico() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await supabase
        .from("transaction_audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet
          setTotalCount(0);
          setLogs([]);
          return;
        }
        throw error;
      }

      setTotalCount(count ?? 0);

      // Fetch user details for the logs
      const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
      let userDetails: Record<string, { name: string; email: string }> = {};
      
      if (userIds.length > 0) {
        // We'll try to get profile names if they exist
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
          
        profiles?.forEach(p => {
          userDetails[p.id] = { name: p.full_name || 'Desconhecido', email: '' };
        });
      }

      setLogs((data || []).map((r: any) => ({
        ...r,
        user_name: userDetails[r.user_id]?.name || "Usuário",
      })));
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(log => {
      const descNew = log.new_data?.description?.toLowerCase() || '';
      const descOld = log.old_data?.description?.toLowerCase() || '';
      return descNew.includes(q) || descOld.includes(q) || log.action.toLowerCase().includes(q);
    });
  }, [logs, search]);

  const formatData = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <Badge className="bg-green-500 hover:bg-green-600">Criação</Badge>;
      case 'UPDATE': return <Badge className="bg-blue-500 hover:bg-blue-600">Edição</Badge>;
      case 'DELETE': return <Badge className="bg-red-500 hover:bg-red-600">Exclusão</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

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
            Acompanhe quem criou, editou ou excluiu lançamentos no sistema.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Buscar movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma movimentação de lançamento encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Descrição do Lançamento</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const data = log.action === 'DELETE' ? log.old_data : log.new_data;
                    const amount = data?.amount != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount) : '—';
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatData(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {log.user_name}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={data?.description}>
                          {data?.description || '—'}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {amount}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Página {page + 1} de {totalPages} • {totalCount.toLocaleString("pt-BR")} eventos
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
    </div>
  );
}

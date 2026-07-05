import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle, ArrowLeftRight, Building2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type OrphanRow = {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  transfer_id: string;
  type: string;
};

type DivergentRow = {
  transfer_id: string;
  side_a_id: string;
  side_a_amount: number;
  side_b_id: string;
  side_b_amount: number;
  description: string;
  competence_date: string;
};

type MissingContextRow = {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  bank_account_name: string;
  expected_company: string;
};

type OrphanAccountRow = {
  id: string;
  name: string;
  type: string | null;
  transactions_count: number;
};

type CompanyOption = { id: string; name: string };

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  try { return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return iso; }
}

export default function HubIntegridade() {
  const { user } = useAuth();
  const { isHubMember } = useHub();

  const [loading, setLoading] = useState(false);
  const [orphans, setOrphans] = useState<OrphanRow[]>([]);
  const [divergent, setDivergent] = useState<DivergentRow[]>([]);
  const [missingCtx, setMissingCtx] = useState<MissingContextRow[]>([]);
  const [orphanAccounts, setOrphanAccounts] = useState<OrphanAccountRow[]>([]);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [pendingAccountCompany, setPendingAccountCompany] = useState<Record<string, string>>({});
  const [fixingOrphan, setFixingOrphan] = useState<string | null>(null);
  const [fixingCtx, setFixingCtx] = useState<string | null>(null);
  const [fixingAccount, setFixingAccount] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Anomaly 1: transfer_id órfão (par não existe)
      const { data: allTransfers, error: e1 } = await supabase
        .from("transactions")
        .select("id, description, amount, competence_date, transfer_id, type")
        .eq("user_id", user.id)
        .not("transfer_id", "is", null);
      if (e1) throw e1;

      const groups = new Map<string, typeof allTransfers>();
      (allTransfers || []).forEach((t) => {
        const arr = groups.get(t.transfer_id!) || [];
        arr.push(t);
        groups.set(t.transfer_id!, arr);
      });
      const orphanList: OrphanRow[] = [];
      const divergentList: DivergentRow[] = [];
      groups.forEach((rows) => {
        if (rows.length === 1) {
          const r = rows[0];
          orphanList.push({
            id: r.id, description: r.description, amount: Number(r.amount),
            competence_date: r.competence_date, transfer_id: r.transfer_id!, type: r.type,
          });
        } else if (rows.length === 2) {
          const [a, b] = rows;
          if (Math.abs(Number(a.amount) - Number(b.amount)) > 0.01) {
            divergentList.push({
              transfer_id: a.transfer_id!,
              side_a_id: a.id, side_a_amount: Number(a.amount),
              side_b_id: b.id, side_b_amount: Number(b.amount),
              description: a.description,
              competence_date: a.competence_date,
            });
          }
        }
      });

      // Anomaly 2: receita com company_id NULL em conta que TEM company_id
      const { data: missingData, error: e2 } = await supabase
        .from("transactions")
        .select(`
          id, description, amount, competence_date, bank_account_id,
          bank_accounts!inner(name, company_id, companies!inner(name))
        `)
        .eq("user_id", user.id)
        .eq("type", "receita")
        .is("company_id", null)
        .not("bank_accounts.company_id", "is", null);
      if (e2) throw e2;

      const missingList: MissingContextRow[] = (missingData || []).map((t: any) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        competence_date: t.competence_date,
        bank_account_name: t.bank_accounts?.name || "—",
        expected_company: t.bank_accounts?.companies?.name || "—",
      }));

      // Anomaly 4: contas bancárias sem company_id (raiz do problema)
      const { data: orphanAccData, error: e3 } = await supabase
        .from("bank_accounts")
        .select("id, name, type")
        .eq("user_id", user.id)
        .is("company_id", null);
      if (e3) throw e3;

      const orphanAccList: OrphanAccountRow[] = [];
      for (const acc of orphanAccData || []) {
        const { count } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("bank_account_id", acc.id);
        orphanAccList.push({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          transactions_count: count ?? 0,
        });
      }

      // Companies for the select
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      setOrphans(orphanList);
      setDivergent(divergentList);
      setMissingCtx(missingList);
      setOrphanAccounts(orphanAccList);
      setCompanyOptions(companyData || []);
    } catch (err: any) {
      toast.error("Erro ao verificar integridade: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { runChecks(); }, [runChecks]);

  const fixOrphan = async (id: string) => {
    setFixingOrphan(id);
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ transfer_id: null, is_internal_transfer: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Vínculo de transferência removido");
      setOrphans((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setFixingOrphan(null);
    }
  };

  const fixMissingContext = async (row: MissingContextRow, companyId: string | null) => {
    // We need the company_id from the account. Re-fetch to be safe.
    setFixingCtx(row.id);
    try {
      const { data: acc, error: e1 } = await supabase
        .from("bank_accounts")
        .select("company_id")
        .eq("id", (await supabase.from("transactions").select("bank_account_id").eq("id", row.id).single()).data?.bank_account_id || "")
        .single();
      if (e1) throw e1;
      const cid = companyId ?? acc?.company_id;
      if (!cid) throw new Error("Conta sem contexto");
      const { error } = await supabase
        .from("transactions")
        .update({ company_id: cid })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Contexto atribuído");
      setMissingCtx((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setFixingCtx(null);
    }
  };

  const fixAllMissingContext = async () => {
    setLoading(true);
    try {
      let fixed = 0;
      for (const row of missingCtx) {
        const { data: tx } = await supabase
          .from("transactions").select("bank_account_id").eq("id", row.id).single();
        if (!tx?.bank_account_id) continue;
        const { data: acc } = await supabase
          .from("bank_accounts").select("company_id").eq("id", tx.bank_account_id).single();
        if (!acc?.company_id) continue;
        const { error } = await supabase
          .from("transactions").update({ company_id: acc.company_id }).eq("id", row.id);
        if (!error) fixed++;
      }
      toast.success(`${fixed} lançamento(s) corrigido(s)`);
      await runChecks();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const assignAccountContext = async (accountId: string) => {
    const targetCompany = pendingAccountCompany[accountId];
    if (!targetCompany) {
      toast.error("Escolha um contexto antes de aplicar");
      return;
    }
    const companyIdToSet = targetCompany === "__personal__" ? null : targetCompany;
    const row = orphanAccounts.find((a) => a.id === accountId);
    if (!row) return;
    const label = companyIdToSet
      ? companyOptions.find((c) => c.id === companyIdToSet)?.name || "empresa"
      : "Pessoal";
    if (!window.confirm(
      `Vincular a conta "${row.name}" ao contexto "${label}"?\n\n` +
      `Isso também vai atribuir esse contexto a ${row.transactions_count} lançamento(s) da conta que hoje estão sem contexto.`
    )) return;

    setFixingAccount(accountId);
    try {
      // 1) Update account
      const { error: e1 } = await supabase
        .from("bank_accounts")
        .update({ company_id: companyIdToSet })
        .eq("id", accountId);
      if (e1) throw e1;

      // 2) Propagate to transactions that are NULL on this account
      const { error: e2 } = await supabase
        .from("transactions")
        .update({ company_id: companyIdToSet })
        .eq("bank_account_id", accountId)
        .is("company_id", null);
      if (e2) throw e2;

      toast.success(`Conta vinculada. ${row.transactions_count} lançamento(s) atribuído(s) a ${label}.`);
      await runChecks();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setFixingAccount(null);
    }
  };

  const totalIssues = orphans.length + divergent.length + missingCtx.length + orphanAccounts.length;

  // Hub members shouldn't see this — only owners
  if (isHubMember) return <Navigate to="/eva-hub/contas" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Saúde de Dados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Anomalias que podem gerar divergência no faturamento e DRE.
          </p>
        </div>
        <Button variant="outline" onClick={runChecks} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Verificar novamente
        </Button>
      </div>

      {/* Summary */}
      {!loading && totalIssues === 0 && (
        <Alert className="border-primary/40 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>Tudo em ordem</AlertTitle>
          <AlertDescription>
            Nenhuma anomalia encontrada. Faturamento e DRE estão consistentes.
          </AlertDescription>
        </Alert>
      )}

      {!loading && totalIssues > 0 && (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{totalIssues} anomalia(s) encontrada(s)</AlertTitle>
          <AlertDescription>
            Corrija os itens abaixo para garantir que o faturamento não seja inflado nem subestimado.
          </AlertDescription>
        </Alert>
      )}

      {/* Anomaly 1 — Transferências órfãs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Transferências órfãs
            <Badge variant={orphans.length ? "destructive" : "secondary"} className="ml-2">
              {orphans.length}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Lançamentos marcados como parte de uma transferência interna mas cujo par (outro lado da transferência) não existe. Isso faz com que sumam do faturamento sem contrapartida.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : orphans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anomalia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{fmtDate(r.competence_date)}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurrency(r.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fixOrphan(r.id)}
                        disabled={fixingOrphan === r.id}
                      >
                        {fixingOrphan === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desvincular"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Anomaly 2 — Pares com valores divergentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Pares de transferência com valores diferentes
            <Badge variant={divergent.length ? "destructive" : "secondary"} className="ml-2">
              {divergent.length}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Transferência interna cujo lado de saída e entrada têm valores distintos. Pode indicar erro de digitação ou taxa não registrada.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : divergent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anomalia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Lado A</TableHead>
                  <TableHead className="text-right">Lado B</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divergent.map((r) => (
                  <TableRow key={r.transfer_id}>
                    <TableCell className="text-sm">{fmtDate(r.competence_date)}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurrency(r.side_a_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurrency(r.side_b_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">
                      {fmtCurrency(Math.abs(r.side_a_amount - r.side_b_amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Anomaly 3 — Receita sem contexto em conta com contexto */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Receitas sem contexto
                <Badge variant={missingCtx.length ? "destructive" : "secondary"} className="ml-2">
                  {missingCtx.length}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Receitas cadastradas em contas que têm empresa vinculada, mas o lançamento ficou sem contexto. Faz o valor sumir dos filtros por empresa.
              </p>
            </div>
            {missingCtx.length > 0 && (
              <Button size="sm" onClick={fixAllMissingContext} disabled={loading}>
                Corrigir todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : missingCtx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anomalia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Contexto esperado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingCtx.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{fmtDate(r.competence_date)}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-sm">{r.bank_account_name}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline">{r.expected_company}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurrency(r.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fixMissingContext(r, null)}
                        disabled={fixingCtx === r.id}
                      >
                        {fixingCtx === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

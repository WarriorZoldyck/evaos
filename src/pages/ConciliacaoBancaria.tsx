import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useAsaasIntegration } from "@/hooks/useAsaasIntegration";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ArrowLeftRight, AlertTriangle, Check, X, ExternalLink } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ManualMatchModal } from "@/components/conciliacao/ManualMatchModal";
import { Link } from "react-router-dom";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface SyncItem {
  id: string;
  integration_id: string;
  asaas_id: string;
  source_type: string;
  amount: number;
  date: string;
  description: string;
  asaas_status: string | null;
  match_status: "pending" | "matched" | "ignored" | "imported";
  matched_transaction_id: string | null;
  payload: any;
}

export default function ConciliacaoBancaria() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { bankAccounts } = useAccounts();
  const { list: integrationsQ, sync } = useAsaasIntegration();

  const integrations = integrationsQ.data || [];
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");
  const [period, setPeriod] = useState("30");
  const [tab, setTab] = useState<"pending" | "matched" | "ignored">("pending");
  const [manualItem, setManualItem] = useState<SyncItem | null>(null);

  const activeIntegration = integrations.find((i) => i.id === (selectedIntegrationId || integrations[0]?.id));
  const activeBankAccount = bankAccounts.find((b) => b.id === activeIntegration?.bank_account_id);

  const fromDate = useMemo(() => subDays(new Date(), Number(period)), [period]);

  const itemsQ = useQuery({
    queryKey: ["asaas_sync_items", activeIntegration?.id, period, tab],
    enabled: !!user?.id && !!activeIntegration?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asaas_sync_items")
        .select("*")
        .eq("integration_id", activeIntegration!.id)
        .eq("match_status", tab)
        .gte("date", format(fromDate, "yyyy-MM-dd"))
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as SyncItem[]) || [];
    },
  });

  const balanceQ = useQuery({
    queryKey: ["account_balance", activeBankAccount?.id],
    enabled: !!activeBankAccount?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_account_balance", { account_id_param: activeBankAccount!.id });
      if (error) throw error;
      return Number(data || 0);
    },
  });

  const asaasBalance = activeIntegration?.initial_balance_synced ?? 0;
  const sysBalance = balanceQ.data ?? 0;
  const diff = Number(asaasBalance) - Number(sysBalance);

  const handleConfirmMatch = async (item: SyncItem, transactionId: string) => {
    const { error: e1 } = await supabase
      .from("asaas_sync_items")
      .update({ match_status: "matched", matched_transaction_id: transactionId })
      .eq("id", item.id);
    if (e1) { toast({ title: "Erro", description: e1.message, variant: "destructive" }); return; }
    const { error: e2 } = await supabase
      .from("transactions")
      .update({ is_reconciled: true })
      .eq("id", transactionId);
    if (e2) { toast({ title: "Erro", description: e2.message, variant: "destructive" }); return; }
    toast({ title: "Conciliado!" });
    qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
  };

  const handleIgnore = async (item: SyncItem) => {
    const { error } = await supabase
      .from("asaas_sync_items")
      .update({ match_status: "ignored" })
      .eq("id", item.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
  };

  const handleUnmatch = async (item: SyncItem) => {
    if (item.matched_transaction_id) {
      await supabase.from("transactions").update({ is_reconciled: false }).eq("id", item.matched_transaction_id);
    }
    await supabase.from("asaas_sync_items").update({ match_status: "pending", matched_transaction_id: null }).eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["asaas_sync_items"] });
  };

  // Suggestion match (single suggestion case): check candidates inline
  const suggestionsQ = useQuery({
    queryKey: ["match_suggestions", activeIntegration?.id, tab, itemsQ.data?.length],
    enabled: tab === "pending" && !!itemsQ.data && itemsQ.data.length > 0,
    queryFn: async () => {
      const map: Record<string, any[]> = {};
      const items = itemsQ.data!;
      for (const item of items) {
        const dFrom = subDays(new Date(item.date), 3);
        const dTo = subDays(new Date(item.date), -3);
        const { data } = await supabase
          .from("transactions")
          .select("id, description, amount, payment_date, type")
          .eq("user_id", user!.id)
          .eq("bank_account_id", activeIntegration!.bank_account_id)
          .eq("amount", item.amount)
          .gte("payment_date", format(dFrom, "yyyy-MM-dd"))
          .lte("payment_date", format(dTo, "yyyy-MM-dd"))
          .eq("is_reconciled", false)
          .limit(5);
        map[item.id] = data || [];
      }
      return map;
    },
  });

  if (integrationsQ.isLoading) {
    return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (integrations.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" /> Conciliação Bancária
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Compare o que está no banco com o que está no sistema.</p>
        </div>
        <Card className="p-12 text-center space-y-4">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">Nenhuma integração bancária conectada</h3>
          <p className="text-muted-foreground text-sm">
            Conecte sua conta Asaas para começar a conciliar suas movimentações automaticamente.
          </p>
          <Button asChild>
            <Link to="/integracoes">Conectar Asaas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" /> Conciliação Bancária
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Última sync:{" "}
            {activeIntegration?.last_sync_at
              ? format(new Date(activeIntegration.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : "nunca"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedIntegrationId || activeIntegration?.id || ""} onValueChange={setSelectedIntegrationId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {integrations.map((i) => {
                const acc = bankAccounts.find((b) => b.id === i.bank_account_id);
                return <SelectItem key={i.id} value={i.id}>{acc?.name || "Conta Asaas"}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => sync.mutate(activeIntegration?.id)}
            disabled={sync.isPending}
          >
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Saldo Asaas (última sync)</p>
          <p className="text-2xl font-bold mt-1">{fmt(Number(asaasBalance))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Saldo no sistema</p>
          <p className="text-2xl font-bold mt-1">{fmt(Number(sysBalance))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Diferença</p>
          <p className={`text-2xl font-bold mt-1 ${Math.abs(diff) < 0.01 ? "text-emerald-500" : "text-amber-500"}`}>
            {fmt(diff)}
          </p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="matched">Conciliados</TabsTrigger>
          <TabsTrigger value="ignored">Ignorados</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {itemsQ.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (itemsQ.data || []).length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Nenhum item nesta categoria.
            </Card>
          ) : (
            <div className="space-y-2">
              {itemsQ.data!.map((item) => {
                const suggestions = suggestionsQ.data?.[item.id] || [];
                const single = tab === "pending" && suggestions.length === 1 ? suggestions[0] : null;
                return (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.source_type === "payment" ? "Cobrança" : "Extrato"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="font-medium mt-1 truncate">{item.description}</p>
                        <p className="text-lg font-bold">{fmt(item.amount)}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        {tab === "pending" && (
                          <>
                            {single ? (
                              <Button size="sm" onClick={() => handleConfirmMatch(item, single.id)}>
                                <Check className="h-4 w-4 mr-1" />
                                Confirmar match
                              </Button>
                            ) : suggestions.length > 1 ? (
                              <Button size="sm" variant="secondary" onClick={() => setManualItem(item)}>
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                {suggestions.length} sugestões
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setManualItem(item)}>
                                Buscar lançamento
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleIgnore(item)}>
                              <X className="h-4 w-4 mr-1" /> Ignorar
                            </Button>
                          </>
                        )}
                        {tab === "matched" && (
                          <Button size="sm" variant="outline" onClick={() => handleUnmatch(item)}>
                            Desfazer
                          </Button>
                        )}
                        {tab === "ignored" && (
                          <Button size="sm" variant="outline" onClick={() => handleUnmatch(item)}>
                            Reativar
                          </Button>
                        )}
                        {item.payload?.invoiceUrl && (
                          <a
                            href={item.payload.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1 px-2"
                          >
                            <ExternalLink className="h-3 w-3" /> Asaas
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {manualItem && activeIntegration && (
        <ManualMatchModal
          item={manualItem}
          bankAccountId={activeIntegration.bank_account_id}
          onClose={() => setManualItem(null)}
          onConfirm={async (txId) => {
            await handleConfirmMatch(manualItem, txId);
            setManualItem(null);
          }}
        />
      )}
    </div>
  );
}

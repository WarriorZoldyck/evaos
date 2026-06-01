import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plug, MessageCircle, RefreshCw, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useAsaasIntegration } from "@/hooks/useAsaasIntegration";
import { usePluggyIntegration } from "@/hooks/usePluggyIntegration";
import { useItauIntegration } from "@/hooks/useItauIntegration";
import { useAccounts } from "@/hooks/useAccounts";
import { AsaasConnectModal } from "@/components/integracoes/AsaasConnectModal";
import { PluggyConnectModal } from "@/components/integracoes/PluggyConnectModal";
import { ItauConnectModal } from "@/components/integracoes/ItauConnectModal";
import logoAsaas from "@/assets/logo-asaas.png";
import logoBradesco from "@/assets/logo-bradesco.png";
import logoItau from "@/assets/logo-itau.png";
import logoSantander from "@/assets/logo-santander.png";
import logoC6Bank from "@/assets/logo-c6bank.png";
import logoApplePay from "@/assets/logo-applepay.png";
import logoSamsungPay from "@/assets/logo-samsungpay.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const otherBanks = [
  { name: "Bradesco", description: "Conexão com o Bradesco para importação automática de extratos.", logo: logoBradesco, bgClass: "bg-white" },
  { name: "Santander", description: "Conexão com o Santander para importação automática de extratos.", logo: logoSantander, bgClass: "bg-white" },
  { name: "C6 Bank", description: "Conexão com o C6 Bank para importação automática de extratos.", logo: logoC6Bank, bgClass: "bg-white" },
  { name: "Apple Pay", description: "Compras via Apple Pay aparecem na fatura do cartão real. Conecte seu cartão via Open Finance (Pluggy) para captura automática.", logo: logoApplePay, bgClass: "bg-white" },
  { name: "Samsung Pay", description: "Compras via Samsung Pay aparecem na fatura do cartão real. Conecte seu cartão via Open Finance (Pluggy) para captura automática.", logo: logoSamsungPay, bgClass: "bg-white" },
];

export default function Integracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [whatsappActive, setWhatsappActive] = useState(false);
  const [isSyncingWhatsapp, setIsSyncingWhatsapp] = useState(false);
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  const [pluggyModalOpen, setPluggyModalOpen] = useState(false);
  const [itauModalOpen, setItauModalOpen] = useState(false);

  const { list: integrationsQ, sync, disconnect } = useAsaasIntegration();
  const { list: pluggyListQ, sync: pluggySync, disconnect: pluggyDisconnect } = usePluggyIntegration();
  const { list: itauListQ, sync: itauSync, disconnect: itauDisconnect } = useItauIntegration();
  const { bankAccounts } = useAccounts();
  const integrations = integrationsQ.data || [];
  const pluggyIntegrations = pluggyListQ.data || [];
  const itauIntegrations = itauListQ.data || [];
  const hasAsaas = integrations.length > 0;
  const hasPluggy = pluggyIntegrations.length > 0;
  const hasItau = itauIntegrations.length > 0;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("whatsapp_number").eq("id", user.id).single()
      .then(({ data }) => setWhatsappActive(!!data?.whatsapp_number));
  }, [user]);

  const handleSyncWhatsappWebhook = async () => {
    setIsSyncingWhatsapp(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-webhook-config", { method: "POST" });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.data?.message || "A Evolution não confirmou.");
      toast({ title: "Webhook reconfigurado" });
    } catch (e) {
      toast({ title: "Falha", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSyncingWhatsapp(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas contas bancárias e serviços para automatizar sua gestão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* WhatsApp */}
        <Card className={`relative overflow-hidden ${whatsappActive ? "" : "opacity-80"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
              </div>
              <Badge className={whatsappActive ? "bg-green-500/15 text-green-500 border-0 text-xs" : "bg-primary/10 text-primary border-0 text-xs"}>
                {whatsappActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Envie lançamentos pelo WhatsApp com a EVA.</p>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={handleSyncWhatsappWebhook} disabled={isSyncingWhatsapp || !user}>
              {isSyncingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconfigurar webhook
            </Button>
          </CardContent>
        </Card>

        {/* Asaas — ATIVO */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#2532c4] flex items-center justify-center overflow-hidden">
                  <img src={logoAsaas} alt="Asaas" className="h-8 w-8 object-contain" />
                </div>
                <CardTitle className="text-base">Asaas</CardTitle>
              </div>
              <Badge className={hasAsaas ? "bg-green-500/15 text-green-500 border-0 text-xs" : "bg-primary/10 text-primary border-0 text-xs"}>
                {hasAsaas ? "Conectado" : "Disponível"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Asaas para importar extrato e cobranças, e fazer conciliação bancária automática.
            </p>
            {hasAsaas ? (
              <div className="mt-4 space-y-2">
                {integrations.map((i) => {
                  const acc = bankAccounts.find((b) => b.id === i.bank_account_id);
                  return (
                    <div key={i.id} className="text-xs p-2 rounded-md border bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{acc?.name || "Conta"}</span>
                        <span className="text-muted-foreground">
                          {i.last_sync_at ? format(new Date(i.last_sync_at), "dd/MM HH:mm", { locale: ptBR }) : "nunca sync"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="default" className="flex-1">
                    <Link to="/conciliacao-bancaria">Conciliar</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>
                    {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAsaasModalOpen(true)}>
                    <Link2 className="h-4 w-4" /> Outra
                  </Button>
                  {integrations.length === 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => disconnect.mutate(integrations[0].id)}
                      disabled={disconnect.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-4 w-full" onClick={() => setAsaasModalOpen(true)}>
                <Plug className="h-4 w-4" /> Conectar Asaas
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pluggy (Open Finance multibanco) — ATIVO */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Pluggy</CardTitle>
              </div>
              <Badge className={hasPluggy ? "bg-green-500/15 text-green-500 border-0 text-xs" : "bg-primary/10 text-primary border-0 text-xs"}>
                {hasPluggy ? "Conectado" : "Disponível"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Open Finance multibanco. Conecte Itaú, Bradesco, Santander, Nubank, C6 e outros via Pluggy.
            </p>
            {hasPluggy ? (
              <div className="mt-4 space-y-2">
                {pluggyIntegrations.map((i) => {
                  const acc = bankAccounts.find((b) => b.id === i.bank_account_id);
                  return (
                    <div key={i.id} className="text-xs p-2 rounded-md border bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {i.institution_name || "Banco"} {acc?.name ? `• ${acc.name}` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {i.last_sync_at ? format(new Date(i.last_sync_at), "dd/MM HH:mm", { locale: ptBR }) : "nunca sync"}
                        </span>
                      </div>
                      {i.last_error && (
                        <div className="text-destructive mt-1 truncate" title={i.last_error}>{i.last_error}</div>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="default" className="flex-1">
                    <Link to="/conciliacao-bancaria">Conciliar</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => pluggySync.mutate(undefined)} disabled={pluggySync.isPending}>
                    {pluggySync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPluggyModalOpen(true)}>
                    <Link2 className="h-4 w-4" /> Outra
                  </Button>
                  {pluggyIntegrations.length === 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => pluggyDisconnect.mutate(pluggyIntegrations[0].id)}
                      disabled={pluggyDisconnect.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-4 w-full" onClick={() => setPluggyModalOpen(true)}>
                <Plug className="h-4 w-4" /> Conectar via Pluggy
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Itaú — API nativa */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={logoItau} alt="Itaú" className="h-8 w-8 object-contain" />
                </div>
                <CardTitle className="text-base">Itaú</CardTitle>
              </div>
              <Badge className={hasItau ? "bg-green-500/15 text-green-500 border-0 text-xs" : "bg-primary/10 text-primary border-0 text-xs"}>
                {hasItau ? "Conectado" : "Disponível"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Integração nativa via API do Itaú (Open Finance). Requer client_id, client_secret e certificado mTLS para produção.
            </p>
            {hasItau ? (
              <div className="mt-4 space-y-2">
                {itauIntegrations.map((i) => {
                  const acc = bankAccounts.find((b) => b.id === i.bank_account_id);
                  return (
                    <div key={i.id} className="text-xs p-2 rounded-md border bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {acc?.name || "Conta"} <span className="text-muted-foreground">• {i.environment}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {i.last_sync_at ? format(new Date(i.last_sync_at), "dd/MM HH:mm", { locale: ptBR }) : "nunca sync"}
                        </span>
                      </div>
                      {i.last_error && (
                        <div className="text-destructive mt-1 truncate" title={i.last_error}>{i.last_error}</div>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="default" className="flex-1">
                    <Link to="/conciliacao-bancaria">Conciliar</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => itauSync.mutate(undefined)} disabled={itauSync.isPending}>
                    {itauSync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setItauModalOpen(true)}>
                    <Link2 className="h-4 w-4" /> Outra
                  </Button>
                  {itauIntegrations.length === 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => itauDisconnect.mutate(itauIntegrations[0].id)}
                      disabled={itauDisconnect.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-4 w-full" onClick={() => setItauModalOpen(true)}>
                <Plug className="h-4 w-4" /> Conectar Itaú
              </Button>
            )}
          </CardContent>
        </Card>


        {otherBanks.map((b) => (
          <Card key={b.name} className="relative overflow-hidden opacity-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${b.bgClass} flex items-center justify-center overflow-hidden`}>
                    <img src={b.logo} alt={b.name} className="h-8 w-8 object-contain" />
                  </div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Em breve</Badge>
              </div>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{b.description}</p></CardContent>
          </Card>
        ))}

        <Card className="border-dashed opacity-50 flex items-center justify-center min-h-[140px]">
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Plug className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Mais integrações em breve</p>
          </CardContent>
        </Card>
      </div>

      <AsaasConnectModal open={asaasModalOpen} onClose={() => setAsaasModalOpen(false)} />
      <PluggyConnectModal open={pluggyModalOpen} onClose={() => setPluggyModalOpen(false)} />
      <ItauConnectModal open={itauModalOpen} onClose={() => setItauModalOpen(false)} />
    </div>
  );
}

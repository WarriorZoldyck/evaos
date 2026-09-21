import { Link, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";

const FREE_PATHS = ["/planos", "/configuracoes/assinatura"];

export function SubscriptionBanner() {
  const { subscription, isInTrial, isInGrace, isBlocked, noSubscription, isLoading, isSyncing, syncSubscription, daysToBlock } =
    useSubscription();
  if (isLoading) return null;

  const handleSync = async () => {
    toast.loading("Verificando pagamento no Asaas...", { id: "sync-sub" });
    const res = await syncSubscription();
    if (res?.subscription?.status === "active") {
      toast.success("Pagamento confirmado! Sua assinatura está ativa.", { id: "sync-sub" });
    } else {
      toast.info("Pagamento ainda pendente de confirmação no Asaas. Se acabou de pagar, aguarde 1 a 2 minutos.", { id: "sync-sub" });
    }
  };

  if (isBlocked) {
    return (
      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/40 text-sm flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          Sua assinatura foi {subscription?.status === "canceled" ? "cancelada" : "encerrada"}. Reative para continuar usando a EVA.
        </span>
        <div className="flex items-center gap-3">
          {subscription?.asaas_subscription_id && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
              Já paguei
            </button>
          )}
          <Link to="/planos" className="text-destructive font-semibold hover:underline">
            Reativar →
          </Link>
        </div>
      </div>
    );
  }

  if (noSubscription) {
    return (
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          Você ainda não tem uma assinatura. Assine agora para usar a EVA.
        </span>
        <Link to="/planos" className="text-primary font-semibold hover:underline">
          Ver planos →
        </Link>
      </div>
    );
  }

  if (isInTrial && subscription?.trial_ends_at) {
    const days = Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()));
    return (
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          Período de teste — {days} dia{days !== 1 ? "s" : ""} restante{days !== 1 ? "s" : ""}.
        </span>
        <Link to="/configuracoes/assinatura" className="text-primary font-semibold hover:underline">
          Gerenciar →
        </Link>
      </div>
    );
  }

  if (isInGrace) {
    return (
      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/40 text-sm flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          Pagamento em atraso — seu acesso será bloqueado em {daysToBlock} dia{daysToBlock !== 1 ? "s" : ""} se não for regularizado.
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Verificando..." : "Já paguei / Atualizar"}
          </button>
          {subscription?.invoice_url ? (
            <a href={subscription.invoice_url} target="_blank" rel="noreferrer" className="text-destructive font-semibold hover:underline">
              Pagar agora →
            </a>
          ) : (
            <Link to="/configuracoes/assinatura" className="text-destructive font-semibold hover:underline">
              Pagar agora →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function SubscriptionBlockedScreen() {
  const { subscription, isSyncing, syncSubscription } = useSubscription();

  const handleSync = async () => {
    toast.loading("Verificando status no Asaas...", { id: "sync-blocked" });
    const res = await syncSubscription();
    if (res?.subscription?.status === "active") {
      toast.success("Assinatura confirmada e reativada com sucesso!", { id: "sync-blocked" });
    } else {
      toast.info("Nenhum pagamento confirmado identificado no momento.", { id: "sync-blocked" });
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-border bg-card">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Acesso bloqueado</h2>
        <p className="text-muted-foreground">
          Sua assinatura está {subscription?.status === "canceled" ? "cancelada" : "vencida"}. Regularize o pagamento para
          liberar a EVA novamente — seus dados continuam guardados.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {subscription?.invoice_url ? (
            <a
              href={subscription.invoice_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Pagar fatura
            </a>
          ) : null}
          <Link
            to="/planos"
            className="inline-block px-6 py-3 rounded-xl border border-border font-semibold hover:bg-muted"
          >
            Ver planos / Reativar
          </Link>
          {subscription?.asaas_subscription_id && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Verificando pagamento..." : "Já paguei, atualizar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bloqueia o conteúdo do app quando a assinatura está vencida/cancelada. */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isBlocked, isLoading } = useSubscription();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isFreePath = FREE_PATHS.some((p) => location.pathname.startsWith(p));
  if (isBlocked && !isFreePath) return <SubscriptionBlockedScreen />;

  return <>{children}</>;
}

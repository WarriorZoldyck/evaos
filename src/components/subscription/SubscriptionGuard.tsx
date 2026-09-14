import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, Loader2, RefreshCw } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { toast } from "sonner";

const ALLOWED_WHEN_BLOCKED = ["/planos", "/configuracoes/assinatura"];

function useRefreshPayment() {
  const { refetch } = useSubscription();
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("subscription-refresh");
      if (error) throw error;
      await refetch();
      if ((data as { released?: boolean } | null)?.released) {
        toast.success("Pagamento confirmado! Seu acesso foi liberado.");
      } else {
        toast.info("Ainda não identificamos o pagamento. Se você acabou de pagar, aguarde alguns minutos.");
      }
    } catch (e) {
      toast.error("Não foi possível verificar o pagamento agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return { refresh, loading };
}

export function SubscriptionBanner() {
  const { subscription, isInTrial, isPastDue, isInGrace, isBlocked, noSubscription, blockAt, daysToBlock, isLoading } =
    useSubscription();
  if (isLoading) return null;

  if (isBlocked) {
    return (
      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/40 text-sm flex items-center justify-between">
        <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Seu acesso está bloqueado por falta de pagamento.</span>
        <Link to="/planos" className="text-destructive font-semibold hover:underline">Regularizar →</Link>
      </div>
    );
  }

  if (noSubscription) {
    return (
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center justify-between">
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Você ainda não tem uma assinatura. Assine agora para usar a EVA.</span>
        <Link to="/planos" className="text-primary font-semibold hover:underline">Ver planos →</Link>
      </div>
    );
  }

  if (isPastDue && isInGrace) {
    return (
      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/40 text-sm flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Pagamento em atraso — seu acesso será bloqueado
          {blockAt ? ` em ${format(blockAt, "dd/MM")}` : ""}
          {daysToBlock > 0 ? ` (${daysToBlock} dia${daysToBlock !== 1 ? "s" : ""})` : ""}.
        </span>
        <a
          href={subscription?.invoice_url || "/configuracoes/assinatura"}
          target={subscription?.invoice_url ? "_blank" : undefined}
          rel="noreferrer"
          className="text-destructive font-semibold hover:underline"
        >
          Pagar agora →
        </a>
      </div>
    );
  }

  if (isInTrial && subscription?.trial_ends_at) {
    const days = Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()));
    return (
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center justify-between">
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Período de teste — {days} dia{days !== 1 ? "s" : ""} restante{days !== 1 ? "s" : ""}.</span>
        <Link to="/configuracoes/assinatura" className="text-primary font-semibold hover:underline">Gerenciar →</Link>
      </div>
    );
  }

  return null;
}

export function SubscriptionBlockedScreen() {
  const { subscription } = useSubscription();
  const { refresh, loading } = useRefreshPayment();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-destructive/40 bg-card">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Acesso bloqueado</h2>
        <p className="text-muted-foreground">
          Identificamos uma pendência no pagamento da sua assinatura. Seus dados estão salvos e voltam a ficar
          disponíveis assim que o pagamento for confirmado.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {subscription?.invoice_url ? (
            <a
              href={subscription.invoice_url}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Pagar agora
            </a>
          ) : (
            <Link
              to="/planos"
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Reativar assinatura
            </Link>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="px-6 py-3 rounded-xl border border-border font-semibold hover:bg-muted inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Já paguei, atualizar
          </button>
          <Link to="/configuracoes/assinatura" className="text-sm text-muted-foreground hover:underline pt-1">
            Ver minha assinatura
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isBlocked, isLoading } = useSubscription();
  const location = useLocation();

  if (isLoading) return <>{children}</>;

  const allowed = ALLOWED_WHEN_BLOCKED.some((p) => location.pathname.startsWith(p));
  if (isBlocked && !allowed) {
    return <SubscriptionBlockedScreen />;
  }
  return <>{children}</>;
}

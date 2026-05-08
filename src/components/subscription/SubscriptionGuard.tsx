import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

export function SubscriptionBanner() {
  const { subscription, isInTrial, isInGrace, noSubscription, isLoading } = useSubscription();
  if (isLoading) return null;

  if (noSubscription) {
    return (
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm flex items-center justify-between">
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Você ainda não tem uma assinatura. Comece seu teste gratuito de 7 dias.</span>
        <Link to="/planos" className="text-primary font-semibold hover:underline">Ver planos →</Link>
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
  if (isInGrace && subscription?.grace_until) {
    const days = Math.max(0, differenceInDays(new Date(subscription.grace_until), new Date()));
    return (
      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/40 text-sm flex items-center justify-between">
        <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Pagamento pendente — {days} dia{days !== 1 ? "s" : ""} para regularizar antes do bloqueio.</span>
        <Link to="/configuracoes/assinatura" className="text-destructive font-semibold hover:underline">Pagar agora →</Link>
      </div>
    );
  }
  return null;
}

export function SubscriptionBlockedScreen() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-border bg-card">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Assinatura expirada</h2>
        <p className="text-muted-foreground">Seu acesso à EVA foi pausado. Reative sua assinatura para continuar usando todos os recursos.</p>
        <Link to="/planos" className="inline-block mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90">
          Reativar assinatura
        </Link>
      </div>
    </div>
  );
}

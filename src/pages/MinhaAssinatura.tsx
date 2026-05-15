import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function MinhaAssinatura() {
  const navigate = useNavigate();
  const { subscription, isInTrial, isActive, isInGrace, isBlocked, noSubscription, isLoading, refetch } = useSubscription();
  const [canceling, setCanceling] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (noSubscription) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center space-y-4">
        <h1 className="text-2xl font-bold">Você ainda não tem uma assinatura</h1>
        <p className="text-muted-foreground">Assine agora e comece a usar a EVA OS.</p>
        <Button onClick={() => navigate("/planos")}>Ver planos</Button>
      </div>
    );
  }

  const cancel = async () => {
    setCanceling(true);
    try {
      const { error } = await supabase.functions.invoke("asaas-cancel-subscription", { body: {} });
      if (error) throw error;
      toast.success("Assinatura cancelada");
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCanceling(false);
    }
  };

  const fmtDate = (s?: string | null) => s ? format(new Date(s), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—";
  const fmtMoney = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const finalCents = subscription?.plan ? Math.round(subscription.plan.price_cents * (1 - (subscription.discount_percent || 0) / 100)) : 0;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minha Assinatura</h1>
        <p className="text-muted-foreground">Gerencie seu plano e pagamentos</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Plano atual</div>
            <div className="text-2xl font-bold">{subscription?.plan?.name}</div>
            {subscription?.is_beta && <div className="text-xs text-primary font-semibold mt-1">Beta — 50% off vitalício</div>}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Valor mensal</div>
            <div className="text-2xl font-bold">{fmtMoney(finalCents)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInTrial && <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-semibold">Em teste</span>}
          {isActive && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">Ativa</span>}
          {isInGrace && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Pagamento pendente</span>}
          {isBlocked && <span className="text-xs px-2 py-1 rounded-full bg-destructive/15 text-destructive font-semibold">Expirada</span>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
          {isInTrial && <div><div className="text-muted-foreground">Trial termina em</div><div className="font-semibold">{fmtDate(subscription?.trial_ends_at)}</div></div>}
          {subscription?.next_due_date && <div><div className="text-muted-foreground">Próximo vencimento</div><div className="font-semibold">{fmtDate(subscription.next_due_date)}</div></div>}
          {subscription?.last_payment_at && <div><div className="text-muted-foreground">Último pagamento</div><div className="font-semibold">{fmtDate(subscription.last_payment_at)}</div></div>}
          <div><div className="text-muted-foreground">Forma de pagamento</div><div className="font-semibold">{subscription?.billing_type === "CREDIT_CARD" ? "Cartão" : subscription?.billing_type}</div></div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
          {subscription?.invoice_url && (
            <a href={subscription.invoice_url} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" /> Pagar / ver fatura</Button>
            </a>
          )}
          {(isInTrial || isActive) && (
            <Button variant="outline" onClick={() => navigate("/planos")}>Trocar de plano</Button>
          )}
          {isBlocked && (
            <Button onClick={() => navigate("/planos")}>Reativar assinatura</Button>
          )}
          {(isInTrial || isActive || isInGrace) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">Cancelar assinatura</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>Você manterá acesso até o fim do período pago. Após isso, sua conta será bloqueada.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={cancel} disabled={canceling}>{canceling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar cancelamento</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

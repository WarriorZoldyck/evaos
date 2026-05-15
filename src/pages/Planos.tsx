import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface Plan {
  id: string; slug: string; name: string; description: string;
  price_cents: number; yearly_price_cents: number | null; max_users: number; features: string[]; sort_order: number;
}

type PlanState = "current" | "upgrade" | "downgrade" | "subscribe" | "reactivate";

export default function Planos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, hasAccess, refetch } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", cpf_cnpj: "", phone: "", billing_type: "CREDIT_CARD", coupon_code: "" });
  const [switchTarget, setSwitchTarget] = useState<{ plan: Plan; mode: "upgrade" | "downgrade" } | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ps } = await supabase
        .from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
      setPlans((ps || []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  const formatPrice = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getPlanState = (plan: Plan): PlanState => {
    if (!subscription) return "subscribe";
    if (!hasAccess) return "reactivate";
    if (subscription.plan_id === plan.id && subscription.billing_cycle === cycle) return "current";
    return plan.price_cents > (subscription.plan?.price_cents ?? 0) ? "upgrade" : "downgrade";
  };

  const handleClick = (plan: Plan) => {
    if (!user) { navigate("/auth"); return; }
    const state = getPlanState(plan);
    if (state === "current") return;
    if (state === "upgrade" || state === "downgrade") {
      setSwitchTarget({ plan, mode: state });
      return;
    }
    setSelected(plan);
  };

  const submit = async () => {
    if (!selected) return;
    if (!form.name.trim() || !form.cpf_cnpj.trim()) {
      toast.error("Preencha nome e CPF/CNPJ");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-create-subscription", {
        body: {
          plan_slug: selected.slug,
          billing_type: form.billing_type,
          billing_cycle: cycle,
          cpf_cnpj: form.cpf_cnpj,
          name: form.name,
          phone: form.phone,
          coupon_code: form.coupon_code.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Assinatura criada! Redirecionando para pagamento...");
      await refetch();
      setSelected(null);
      if (data.invoice_url) window.location.href = data.invoice_url;
      else navigate("/configuracoes/assinatura");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao criar assinatura");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSwitch = async () => {
    if (!switchTarget) return;
    setSwitching(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-change-plan", {
        body: { plan_slug: switchTarget.plan.slug, billing_cycle: cycle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Plano alterado com sucesso");
      await refetch();
      setSwitchTarget(null);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao alterar plano");
    } finally {
      setSwitching(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Escolha seu plano</h1>
        <p className="text-muted-foreground mb-6">Assine agora e comece a usar o EVA OS.</p>

        <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              cycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {plans.map((plan) => {
          const monthly = plan.price_cents;
          const yearlyTotal = plan.yearly_price_cents ?? monthly * 12;
          const displayCents = cycle === "monthly" ? monthly : yearlyTotal;
          const suffix = cycle === "monthly" ? "/mês" : "/ano";
          const yearlyMonthlyEquiv = Math.round(yearlyTotal / 12);
          const state = getPlanState(plan);
          const isCurrent = state === "current";
          const buttonLabel =
            state === "current" ? "Plano atual" :
            state === "upgrade" ? "Fazer upgrade" :
            state === "downgrade" ? "Fazer downgrade" :
            state === "reactivate" ? "Reativar com este plano" :
            "Assinar agora";
          return (
            <div key={plan.id} className={`p-6 rounded-2xl border bg-card flex flex-col ${isCurrent ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-xl">{plan.name}</h3>
                {isCurrent && <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-semibold">Atual</span>}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-4">
                <div>
                  <span className="text-4xl font-bold">{formatPrice(displayCents)}</span>
                  <span className="text-muted-foreground text-sm">{suffix}</span>
                </div>
                {cycle === "yearly" && (
                  <div className="text-xs text-muted-foreground mt-1">
                    equivale a {formatPrice(yearlyMonthlyEquiv)}/mês
                  </div>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleClick(plan)}
                disabled={isCurrent}
                variant={isCurrent ? "outline" : "default"}
                className="w-full"
              >
                {buttonLabel}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Modal upgrade/downgrade */}
      <Dialog open={!!switchTarget} onOpenChange={(o) => !o && setSwitchTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {switchTarget?.mode === "upgrade" ? "Fazer upgrade" : "Fazer downgrade"} para {switchTarget?.plan.name}
            </DialogTitle>
            <DialogDescription>
              A mudança vale a partir do próximo vencimento. Você não será cobrado agora — o novo valor ({cycle === "yearly" ? "anual" : "mensal"}) entra em vigor na próxima cobrança recorrente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchTarget(null)} disabled={switching}>Voltar</Button>
            <Button onClick={confirmSwitch} disabled={switching}>
              {switching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subscription && !hasAccess ? "Reativar assinatura" : "Assinar"} {selected?.name} — {cycle === "monthly" ? "Mensal" : "Anual"}
            </DialogTitle>
            {subscription && !hasAccess && (
              <DialogDescription>
                Sua assinatura anterior será reativada. Não há novo período de teste — a primeira cobrança ocorre no próximo dia.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo / Razão social</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>CPF ou CNPJ</Label>
              <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Celular (opcional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <RadioGroup value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="CREDIT_CARD" id="r1" /><Label htmlFor="r1" className="font-normal">Cartão de crédito (recomendado — recorrente automático)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="PIX" id="r2" /><Label htmlFor="r2" className="font-normal">PIX</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="BOLETO" id="r3" /><Label htmlFor="r3" className="font-normal">Boleto</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Cupom de desconto (opcional)</Label>
              <Input
                value={form.coupon_code}
                onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                placeholder="Insira o código do cupom"
              />
            </div>
            {subscription && !hasAccess ? (
              <p className="text-xs text-muted-foreground">Sua assinatura anterior será reativada. A primeira cobrança ocorre no próximo dia.</p>
            ) : (
              <p className="text-xs text-muted-foreground">A primeira cobrança ocorre amanhã.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={submit} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

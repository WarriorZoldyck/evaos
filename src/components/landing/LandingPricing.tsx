import { useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Individual",
    priceCents: 9990,
    description: "Para autônomos e profissionais individuais",
    features: [
      "1 usuário",
      "Lançamentos ilimitados",
      "Dashboard completo",
      "EVA via WhatsApp",
      "Precificação FHC",
      "DRE automático",
      "Plano de caixa",
      "Suporte por email",
    ],
    cta: "Começar 7 dias grátis",
    highlighted: false,
  },
  {
    name: "Família",
    priceCents: 13990,
    description: "Para famílias e equipes pequenas",
    features: [
      "Tudo do Individual",
      "Até 3 usuários",
      "Hub de gestão de membros",
      "Relatórios consolidados",
      "Múltiplas empresas",
      "Suporte prioritário",
    ],
    cta: "Começar 7 dias grátis",
    highlighted: true,
  },
];

const formatBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LandingPricing() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,25%,16%)] to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-[hsl(195,100%,50%)] mb-3 tracking-wider uppercase">Planos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-[hsl(215,18%,55%)] max-w-xl mx-auto mb-6">
            7 dias grátis em qualquer plano. Cancele quando quiser, sem multa.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(195,100%,50%/0.1)] border border-[hsl(195,100%,50%/0.3)] text-[hsl(195,100%,50%)] text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            Beta — 50% off vitalício para os 20 primeiros assinantes
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 items-start max-w-3xl mx-auto">
          {plans.map((plan, i) => {
            const beta = Math.round(plan.priceCents * 0.5);
            return (
            <div
              key={i}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.highlighted
                  ? "border-[hsl(195,100%,50%/0.4)] shadow-[0_0_40px_hsl(195,100%,50%/0.1)]"
                  : "border-[hsl(215,25%,12%)]"
              }`}
              style={{ background: plan.highlighted ? "hsla(220,30%,8%,0.8)" : "hsla(220,30%,7%,0.6)" }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] text-xs font-bold">
                  Mais popular
                </div>
              )}

              <h3 className="font-display font-bold text-xl mb-1">{plan.name}</h3>
              <p className="text-sm text-[hsl(215,18%,55%)] mb-5">{plan.description}</p>

              <div className="mb-6">
                <div className="text-xs text-[hsl(215,18%,55%)] line-through">{formatBRL(plan.priceCents)}/mês</div>
                <span className="font-display text-4xl font-bold">{formatBRL(beta)}</span>
                <span className="text-[hsl(215,18%,55%)] text-sm">/mês</span>
                <div className="text-xs text-[hsl(195,100%,50%)] font-semibold mt-1">Preço beta vitalício</div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-[hsl(195,100%,50%)] mt-0.5 shrink-0" />
                    <span className="text-[hsl(215,18%,65%)]">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/auth")}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] hover:brightness-110 shadow-[0_0_20px_hsl(195,100%,50%/0.25)]"
                    : "border border-[hsl(215,25%,16%)] text-[hsl(210,30%,92%)] hover:border-[hsl(195,100%,50%/0.4)] hover:bg-[hsl(195,100%,50%/0.05)]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,25%,16%)] to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[hsl(195,100%,50%)] mb-3 tracking-wider uppercase">Planos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-[hsl(215,18%,55%)] max-w-xl mx-auto">
            Comece grátis, evolua quando quiser. Sem surpresas, sem taxa de adesão.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.highlighted
                  ? "border-[hsl(195,100%,50%/0.4)] shadow-[0_0_40px_hsl(195,100%,50%/0.1)]"
                  : "border-[hsl(215,25%,12%)]"
              }`}
              style={{ background: plan.highlighted ? "hsla(220,30%,8%,0.8)" : "hsla(220,30%,7%,0.6)" }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] text-xs font-bold">
                  Mais popular
                </div>
              )}

              <h3 className="font-display font-bold text-xl mb-1">{plan.name}</h3>
              <p className="text-sm text-[hsl(215,18%,55%)] mb-5">{plan.description}</p>

              <div className="mb-6">
                <span className="font-display text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-[hsl(215,18%,55%)] text-sm">{plan.period}</span>}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-[hsl(195,100%,50%)] mt-0.5 shrink-0" />
                    <span className="text-[hsl(215,18%,65%)]">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/auth")}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] hover:brightness-110 shadow-[0_0_20px_hsl(195,100%,50%/0.25)]"
                    : "border border-[hsl(215,25%,16%)] text-[hsl(210,30%,92%)] hover:border-[hsl(195,100%,50%/0.4)] hover:bg-[hsl(195,100%,50%/0.05)]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

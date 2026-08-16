import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Individual",
    priceCents: 9990,
    yearlyPriceCents: 99900,
    description: "Para autônomos e profissionais individuais",
    features: [
      "Até 3 contas/cartões/carteiras/maquininhas",
      "100 mensagens da EVA por mês",
      "Lançamentos ilimitados",
      "Dashboard completo",
      "EVA via WhatsApp",
      "Precificação FHC",
      "DRE automático",
      "Fluxo de caixa",
      "Suporte por email",
    ],
    cta: "Assinar agora",
    highlighted: false,
  },
  {
    name: "Família",
    priceCents: 13990,
    yearlyPriceCents: 139900,
    description: "Para famílias e equipes pequenas",
    features: [
      "Tudo do Individual",
      "Contas, cartões e maquininhas ilimitados",
      "500 mensagens da EVA por mês",
      "EVA Hub com até 3 usuários",
      "Usuários extras por R$ 29,90/mês",
      "Relatórios consolidados multi-empresa",
      "Suporte prioritário",
    ],
    cta: "Assinar agora",
    highlighted: true,
  },
];

const formatBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LandingPricing() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="pricing" className="py-20 sm:py-24 bg-[hsl(var(--landing-bg))]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-[hsl(var(--landing-accent))] mb-3 tracking-wider uppercase">Planos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-[hsl(var(--landing-muted))] max-w-xl mx-auto mb-6 text-lg">
            Assine agora e comece a usar a EVA OS. Cancele quando quiser, sem multa.
          </p>

          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-surface))]">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                cycle === "monthly"
                  ? "bg-[hsl(var(--landing-accent))] text-white"
                  : "text-[hsl(var(--landing-muted))] hover:text-[hsl(var(--landing-text))]"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                cycle === "yearly"
                  ? "bg-[hsl(var(--landing-accent))] text-white"
                  : "text-[hsl(var(--landing-muted))] hover:text-[hsl(var(--landing-text))]"
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 items-start max-w-3xl mx-auto">
          {plans.map((plan, i) => {
            const monthly = plan.priceCents;
            const yearlyTotal = plan.yearlyPriceCents;
            const displayCents = cycle === "monthly" ? monthly : yearlyTotal;
            const suffix = cycle === "monthly" ? "/mês" : "/ano";
            const yearlyMonthlyEquiv = Math.round(yearlyTotal / 12);
            return (
            <div
              key={i}
              className={`relative p-8 rounded-2xl border bg-[hsl(var(--landing-card))] transition-all duration-300 ${
                plan.highlighted
                  ? "border-[hsl(var(--landing-accent)/0.45)] shadow-[0_24px_50px_-30px_hsl(var(--landing-accent)/0.6)]"
                  : "border-[hsl(var(--landing-border))]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(var(--landing-accent))] text-white text-xs font-bold">
                  Mais popular
                </div>
              )}

              <h3 className="font-display font-bold text-xl mb-1">{plan.name}</h3>
              <p className="text-sm text-[hsl(var(--landing-muted))] mb-5">{plan.description}</p>

              <div className="mb-6">
                <span className="font-display text-4xl font-bold">{formatBRL(displayCents)}</span>
                <span className="text-[hsl(var(--landing-muted))] text-sm">{suffix}</span>
                {cycle === "yearly" && (
                  <div className="text-xs text-[hsl(var(--landing-muted))] mt-1">
                    equivale a {formatBRL(yearlyMonthlyEquiv)}/mês
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-[hsl(var(--landing-accent))] mt-0.5 shrink-0" />
                    <span className="text-[hsl(var(--landing-muted))]">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate("/auth")}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-[hsl(var(--landing-accent))] text-white hover:brightness-110"
                    : "border border-[hsl(var(--landing-border))] text-[hsl(var(--landing-text))] hover:bg-[hsl(var(--landing-surface))]"
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


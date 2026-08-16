import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "A EVA OS funciona para qualquer tipo de negócio?",
    a: "Sim! Apesar de ter ferramentas especiais para clínicas e consultórios (como precificação FHC), a EVA serve para qualquer profissional autônomo, MEI ou pequena empresa que precise de controle financeiro.",
  },
  {
    q: "Posso separar finanças pessoais e empresariais?",
    a: "Com certeza. Você pode cadastrar múltiplas empresas e alternar entre a visão pessoal e de cada empresa com um clique. Tudo na mesma conta.",
  },
  {
    q: "Como funciona o controle de maquininhas?",
    a: "Você cadastra cada maquininha com suas taxas de débito e crédito, prazo de liquidação (D+2, D+30) e a EVA calcula automaticamente o valor líquido e as datas de crédito de cada venda.",
  },
  {
    q: "O que é a precificação FHC?",
    a: "FHC (Formação de Hora Clínica) é uma metodologia que calcula o custo real da sua hora de trabalho com base nas suas despesas fixas, variáveis e pessoais. A partir disso, a EVA sugere o preço ideal para cada serviço.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, sem fidelidade e sem burocracia. Você pode cancelar seu plano a qualquer momento e continuar usando até o final do período pago.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Totalmente. Usamos criptografia de ponta a ponta, autenticação segura e infraestrutura Supabase com RLS (Row Level Security). Seus dados são acessíveis apenas por você.",
  },
];

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-24 bg-[hsl(var(--landing-surface))]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[hsl(var(--landing-accent))] mb-3 tracking-wider uppercase">FAQ</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Perguntas frequentes
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-card))] overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-sm pr-4">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[hsl(var(--landing-muted))] transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`} />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 -mt-1">
                  <p className="text-sm text-[hsl(var(--landing-muted))] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


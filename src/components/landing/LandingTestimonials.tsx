import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Dra. Mariana S.",
    role: "Dentista — São Paulo",
    text: "Antes da EVA eu não sabia quanto realmente lucrava por procedimento. Agora tenho clareza total e consegui aumentar minha margem em 22%.",
  },
  {
    name: "Carlos R.",
    role: "Clínica de Estética — RJ",
    text: "Gerenciar 3 maquininhas com taxas diferentes era um pesadelo. A EVA me mostra exatamente quanto entra e quando. Revolucionou meu controle.",
  },
  {
    name: "Ana Paula M.",
    role: "Fisioterapeuta — BH",
    text: "Consigo separar minhas finanças pessoais das da clínica na mesma plataforma. A precificação FHC me ajudou a reajustar todos os meus preços.",
  },
];

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="py-20 sm:py-24 bg-[hsl(var(--landing-surface))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[hsl(var(--landing-accent))] mb-3 tracking-wider uppercase">
            Depoimentos
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Quem usa, recomenda</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-card))]"
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" />
                ))}
              </div>
              <p className="text-sm text-[hsl(var(--landing-muted))] leading-relaxed mb-5">
                "{t.text}"
              </p>
              <div>
                <p className="font-semibold text-sm text-[hsl(var(--landing-text))]">{t.name}</p>
                <p className="text-xs text-[hsl(var(--landing-muted))]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

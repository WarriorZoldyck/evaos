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
    <section id="testimonials" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,25%,16%)] to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[hsl(195,100%,50%)] mb-3 tracking-wider uppercase">Depoimentos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Quem usa, recomenda
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-[hsl(215,25%,12%)]"
              style={{ background: "hsla(220,30%,7%,0.6)" }}
            >
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" />
                ))}
              </div>
              <p className="text-sm text-[hsl(215,18%,65%)] leading-relaxed mb-5 italic">
                "{t.text}"
              </p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-[hsl(215,18%,50%)]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

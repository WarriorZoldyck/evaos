import { UserPlus, LayoutDashboard, Rocket } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crie sua conta",
    description: "Cadastro rápido e gratuito. Em menos de 1 minuto você já está dentro da plataforma.",
  },
  {
    icon: LayoutDashboard,
    step: "02",
    title: "Configure suas finanças",
    description: "Cadastre suas contas, categorias e maquininhas. A EVA organiza tudo automaticamente.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Tome decisões inteligentes",
    description: "Com dashboard em tempo real, DRE e precificação, você sabe exatamente onde está e para onde ir.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-[hsl(var(--landing-bg))]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[hsl(var(--landing-accent))] mb-3 tracking-wider uppercase">
            Como funciona
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            3 passos para o controle total
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[62%] w-[76%] h-px bg-[hsl(var(--landing-border))]" />
              )}

              <div className="relative inline-flex items-center justify-center h-20 w-20 rounded-2xl border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-surface))] mb-6 mx-auto">
                <s.icon className="h-8 w-8 text-[hsl(var(--landing-accent))]" />
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[hsl(var(--landing-accent))] text-white text-xs font-bold flex items-center justify-center">
                  {s.step}
                </span>
              </div>

              <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-[hsl(var(--landing-muted))] leading-relaxed max-w-xs mx-auto">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

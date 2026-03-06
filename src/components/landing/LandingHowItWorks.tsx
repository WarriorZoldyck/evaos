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
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,25%,16%)] to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[hsl(195,100%,50%)] mb-3 tracking-wider uppercase">Como funciona</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            3 passos para o controle total
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-[hsl(195,100%,50%/0.3)] to-transparent" />
              )}

              <div className="relative inline-flex items-center justify-center h-20 w-20 rounded-2xl border border-[hsl(195,100%,50%/0.2)] bg-[hsl(195,100%,50%/0.06)] mb-6 mx-auto">
                <s.icon className="h-8 w-8 text-[hsl(195,100%,50%)]" />
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[hsl(195,100%,50%)] text-[hsl(220,40%,6%)] text-xs font-bold flex items-center justify-center">
                  {s.step}
                </span>
              </div>

              <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-[hsl(215,18%,55%)] leading-relaxed max-w-xs mx-auto">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

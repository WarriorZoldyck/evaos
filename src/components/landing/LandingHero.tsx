import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";
import dashboardMockup from "@/assets/landing-dashboard-mockup.png";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar4 from "@/assets/avatar-4.jpg";

const avatars = [avatar1, avatar2, avatar3, avatar4];

const stats = [
  { value: "+500", label: "profissionais ativos" },
  { value: "R$ 40M+", label: "movimentados na plataforma" },
  { value: "98%", label: "recomendam a EVA OS" },
];

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-28 lg:pt-36 pb-16 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[520px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--landing-surface)) 0%, hsl(var(--landing-bg)) 100%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-card))] mb-6">
              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--landing-accent))]" />
              <span className="text-xs font-medium text-[hsl(var(--landing-accent))]">
                Gestão financeira simples e segura
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.08] tracking-tight mb-6">
              Sua empresa e sua vida financeira{" "}
              <span className="text-[hsl(var(--landing-accent))]">no mesmo lugar</span>
            </h1>

            <p className="text-lg text-[hsl(var(--landing-muted))] leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              O EVA OS organiza contas, cartões, maquininhas e relatórios em um painel
              único. Você acompanha entradas, saídas e resultado em tempo real — e decide
              com dados, não com achismo.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <button
                onClick={() => navigate("/auth")}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base bg-[hsl(var(--landing-accent))] text-white hover:brightness-110 transition-all duration-200 shadow-[0_10px_25px_-12px_hsl(var(--landing-accent)/0.7)]"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-sm border border-[hsl(var(--landing-border))] text-[hsl(var(--landing-text))] hover:bg-[hsl(var(--landing-surface))] transition-colors"
              >
                <Play className="h-4 w-4 text-[hsl(var(--landing-accent))]" />
                Ver como funciona
              </a>
            </div>

            <div className="mt-8 flex items-center gap-4 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {avatars.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-[hsl(var(--landing-bg))] object-cover"
                  />
                ))}
              </div>
              <p className="text-sm text-[hsl(var(--landing-muted))]">
                <span className="font-semibold text-[hsl(var(--landing-text))]">+500</span>{" "}
                profissionais já usam
              </p>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2rem] pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 60% 40%, hsl(var(--landing-accent-soft) / 0.18), transparent 70%)",
              }}
            />
            <img
              src={dashboardMockup}
              alt="Painel do EVA OS em notebook e celular mostrando saldo, receitas, despesas e gráficos"
              className="relative w-full h-auto"
              width={1408}
              height={1008}
            />
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 rounded-2xl overflow-hidden border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-surface))]">
          {stats.map((s) => (
            <div
              key={s.label}
              className="px-6 py-6 text-center border-b sm:border-b-0 sm:border-r last:border-0 border-[hsl(var(--landing-border))]"
            >
              <p className="font-display text-2xl font-bold text-[hsl(var(--landing-accent))]">
                {s.value}
              </p>
              <p className="text-sm text-[hsl(var(--landing-muted))] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

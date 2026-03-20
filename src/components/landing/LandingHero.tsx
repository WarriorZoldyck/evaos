import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { HolographicAvatar } from "./HolographicAvatar";

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-12 lg:pt-40 lg:pb-20 overflow-hidden">
      {/* Enhanced background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, hsl(195 100% 50% / 0.2), hsl(200 100% 40% / 0.08) 50%, transparent 70%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(195,100%,50%/0.5)] to-transparent" />
        <div className="absolute top-0 left-1/3 w-px h-full opacity-20" style={{ background: "linear-gradient(to bottom, transparent, hsl(195 100% 50% / 0.4), transparent)" }} />
        <div className="absolute top-0 left-2/3 w-px h-full opacity-15" style={{ background: "linear-gradient(to bottom, transparent, hsl(195 100% 50% / 0.3), transparent)" }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-end">
          {/* Left: Copy */}
          <div className="text-center lg:text-left pb-16 lg:pb-24">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[hsl(195,100%,50%/0.3)] bg-[hsl(195,100%,50%/0.06)] mb-6">
              <div className="h-2 w-2 rounded-full bg-[hsl(195,100%,50%)] animate-pulse shadow-[0_0_8px_hsl(195,100%,50%)]" />
              <span className="text-xs font-medium text-[hsl(195,100%,50%)]">Inteligência financeira ativa</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
              Sua gestão financeira no{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(195 100% 50%), hsl(195 100% 70%))", filter: "drop-shadow(0 0 20px hsl(195 100% 50% / 0.4))" }}>
                piloto automático
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[hsl(215,18%,55%)] leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              EVA OS é o ecossistema inteligente que unifica suas finanças pessoais e empresariais em uma única plataforma. Dashboard em tempo real, precificação inteligente e controle total.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button
                onClick={() => navigate("/auth")}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] hover:brightness-110 transition-all duration-300 shadow-[0_0_40px_hsl(195,100%,50%/0.4),0_0_80px_hsl(195,100%,50%/0.15)]"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium text-sm border border-[hsl(215,25%,16%)] text-[hsl(215,18%,60%)] hover:border-[hsl(195,100%,50%/0.4)] hover:text-[hsl(210,30%,92%)] hover:shadow-[0_0_20px_hsl(195,100%,50%/0.1)] transition-all duration-200"
              >
                <Play className="h-4 w-4" />
                Ver como funciona
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-[hsl(220,30%,4%)] bg-gradient-to-br from-[hsl(195,100%,50%/0.3)] to-[hsl(200,100%,40%/0.3)]" />
                ))}
              </div>
              <div className="text-sm text-[hsl(215,18%,55%)]">
                <span className="font-semibold text-[hsl(210,30%,92%)]">+500</span> profissionais já usam
              </div>
            </div>
          </div>

          {/* Right: Holographic Avatar */}
          <div className="relative flex items-center justify-center overflow-visible">
            <HolographicAvatar />

            {/* Floating stat cards with enhanced glow */}
            <div className="absolute -top-4 -left-4 sm:-left-8 px-4 py-3 rounded-xl border border-[hsl(195,100%,50%/0.2)] shadow-[0_0_15px_hsl(195,100%,50%/0.1)]" style={{ background: "hsla(220,30%,9%,0.9)", backdropFilter: "blur(12px)" }}>
              <p className="text-xs text-[hsl(215,18%,55%)]">Receita mensal</p>
              <p className="text-lg font-bold font-display text-[hsl(152,69%,40%)]">R$ 42.850</p>
            </div>

            <div className="absolute top-1/2 -right-2 sm:-right-6 px-4 py-3 rounded-xl border border-[hsl(195,100%,50%/0.2)] shadow-[0_0_15px_hsl(195,100%,50%/0.1)]" style={{ background: "hsla(220,30%,9%,0.9)", backdropFilter: "blur(12px)" }}>
              <p className="text-xs text-[hsl(215,18%,55%)]">Lucro líquido</p>
              <p className="text-lg font-bold font-display text-[hsl(195,100%,50%)]">68%</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

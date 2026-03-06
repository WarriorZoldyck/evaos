import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import evaLogo from "@/assets/eva-os-logo.jpeg";

export function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer className="relative border-t border-[hsl(215,25%,12%)]">
      {/* Final CTA */}
      <div className="py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, hsl(195 100% 50% / 0.06), transparent 70%)" }} />
        <div className="max-w-2xl mx-auto px-4 relative">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Pronto para transformar suas finanças?
          </h2>
          <p className="text-[hsl(215,18%,55%)] mb-8 text-lg">
            Junte-se a centenas de profissionais que já usam a EVA OS para crescer com inteligência.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] hover:brightness-110 transition-all duration-300 shadow-[0_0_30px_hsl(195,100%,50%/0.3)]"
          >
            Começar agora — é grátis
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[hsl(215,25%,12%)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={evaLogo} alt="EVA OS" className="h-6 w-6 rounded" />
            <span className="text-sm text-[hsl(215,18%,55%)]">© 2025 EVA OS. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[hsl(215,18%,50%)]">
            <a href="#" className="hover:text-[hsl(195,100%,50%)] transition-colors">Termos</a>
            <a href="#" className="hover:text-[hsl(195,100%,50%)] transition-colors">Privacidade</a>
            <a href="#" className="hover:text-[hsl(195,100%,50%)] transition-colors">Contato</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

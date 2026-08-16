import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import evaLogo from "@/assets/eva-os-logo.jpeg";

export function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-bg))]">
      {/* Final CTA */}
      <div className="py-20 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Pronto para transformar suas finanças?
          </h2>
          <p className="text-[hsl(var(--landing-muted))] mb-8 text-lg">
            Junte-se a centenas de profissionais que já usam a EVA OS para crescer com inteligência.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-[hsl(var(--landing-accent))] text-white hover:brightness-110 transition-all duration-200 shadow-[0_14px_30px_-16px_hsl(var(--landing-accent)/0.8)]"
          >
            Começar agora — é grátis
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[hsl(var(--landing-border))] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={evaLogo} alt="EVA OS" className="h-6 w-6 rounded" />
            <span className="text-sm text-[hsl(var(--landing-muted))]">© 2025 EVA OS. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[hsl(var(--landing-muted))]">
            <a href="#" className="hover:text-[hsl(var(--landing-accent))] transition-colors">Termos</a>
            <a href="#" className="hover:text-[hsl(var(--landing-accent))] transition-colors">Privacidade</a>
            <a href="#" className="hover:text-[hsl(var(--landing-accent))] transition-colors">Contato</a>
          </div>
        </div>
      </div>
    </footer>
  );
}


import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import evaLogo from "@/assets/eva-os-logo.jpeg";

const navLinks = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Como funciona", href: "#how-it-works" },
  { label: "Depoimentos", href: "#testimonials" },
  { label: "Planos", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-[hsl(var(--landing-border))]"
      style={{ background: "hsl(var(--landing-bg) / 0.92)", backdropFilter: "blur(16px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg overflow-hidden border border-[hsl(var(--landing-border))]">
              <img src={evaLogo} alt="EVA OS" className="h-full w-full object-cover" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-[hsl(var(--landing-text))]">
              EVA OS
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[hsl(var(--landing-muted))] hover:text-[hsl(var(--landing-accent))] transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-[hsl(var(--landing-muted))] hover:text-[hsl(var(--landing-text))] transition-colors px-4 py-2"
            >
              Entrar
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-[hsl(var(--landing-accent))] text-white hover:brightness-110 transition-all duration-200"
            >
              Começar grátis
            </button>
          </div>

          <button
            className="md:hidden p-2 text-[hsl(var(--landing-text))]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[hsl(var(--landing-border))] py-4 px-4 space-y-3 bg-[hsl(var(--landing-bg))]">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm text-[hsl(var(--landing-muted))] hover:text-[hsl(var(--landing-accent))] py-2"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-[hsl(var(--landing-border))] flex flex-col gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-[hsl(var(--landing-muted))] py-2"
            >
              Entrar
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-[hsl(var(--landing-accent))] text-white"
            >
              Começar grátis
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

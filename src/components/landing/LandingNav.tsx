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
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[hsl(215,25%,12%)]" style={{ background: "hsla(220,30%,4%,0.85)", backdropFilter: "blur(20px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={evaLogo} alt="EVA OS" className="h-8 w-8 rounded-lg" />
            <span className="font-display font-bold text-lg tracking-tight">EVA OS</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[hsl(215,18%,60%)] hover:text-[hsl(195,100%,50%)] transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-[hsl(215,18%,60%)] hover:text-[hsl(210,30%,92%)] transition-colors px-4 py-2"
            >
              Entrar
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)] hover:brightness-110 transition-all duration-200 shadow-[0_0_20px_hsl(195,100%,50%/0.3)]"
            >
              Começar grátis
            </button>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[hsl(215,25%,12%)] py-4 px-4 space-y-3" style={{ background: "hsla(220,30%,4%,0.95)" }}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm text-[hsl(215,18%,60%)] hover:text-[hsl(195,100%,50%)] py-2"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-[hsl(215,25%,12%)] flex flex-col gap-2">
            <button onClick={() => navigate("/auth")} className="text-sm text-[hsl(215,18%,60%)] py-2">Entrar</button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-gradient-to-r from-[hsl(195,100%,50%)] to-[hsl(200,100%,40%)] text-[hsl(220,40%,6%)]"
            >
              Começar grátis
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

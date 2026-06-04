import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import HubLayout from "@/components/layout/HubLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Lancamentos from "@/pages/Lancamentos";
import PlanoDeCaixa from "@/pages/PlanoDeCaixa";
import DRE from "@/pages/DRE";
import Precificacao from "@/pages/Precificacao";
import Contas from "@/pages/Contas";
import Categorias from "@/pages/Categorias";
import Contatos from "@/pages/Contatos";
import Configuracoes from "@/pages/Configuracoes";

import NotFound from "@/pages/NotFound";
import ComingSoon from "@/pages/ComingSoon";
import Docs from "@/pages/Docs";
import Integracoes from "@/pages/Integracoes";
import PrecificacaoV2 from "@/pages/PrecificacaoV2";
import LandingPage from "@/pages/LandingPage";
import Metas from "@/pages/Metas";
import AnalisesEva from "@/pages/AnalisesEva";
import CentrosDeCustos from "@/pages/CentrosDeCustos";
import HubContas from "@/pages/hub/HubContas";
import HubWorkspaces from "@/pages/hub/HubWorkspaces";
import HubMembros from "@/pages/hub/HubMembros";
import HubAuditoria from "@/pages/hub/HubAuditoria";
import HubMeuWhatsApp from "@/pages/hub/HubMeuWhatsApp";
import Planos from "@/pages/Planos";
import MinhaAssinatura from "@/pages/MinhaAssinatura";
import ConciliacaoBancaria from "@/pages/ConciliacaoBancaria";
import { GraduationCap } from "lucide-react";

import { toast } from "sonner";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      toast.error("Ocorreu um erro inesperado. Tente recarregar a página.");
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="eva-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/planos" element={<Planos />} />
                <Route path="/configuracoes/assinatura" element={<MinhaAssinatura />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lancamentos" element={<Lancamentos />} />
                <Route path="/analises-eva" element={<AnalisesEva />} />
                <Route path="/plano-de-caixa" element={<PlanoDeCaixa />} />
                <Route path="/dre" element={<DRE />} />
                <Route path="/precificacao" element={<Precificacao />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/conciliacao-bancaria" element={<ConciliacaoBancaria />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/centros-de-custos" element={<CentrosDeCustos />} />
                <Route path="/contatos" element={<Contatos />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                
                <Route path="/docs" element={<Docs />} />
                <Route path="/integracoes" element={<Integracoes />} />
                <Route path="/eva-kids" element={<ComingSoon title="EVA Kids" description="Educação financeira para crianças. Em breve!" icon={GraduationCap} />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="/precificacao-v2" element={<PrecificacaoV2 />} />
              </Route>
              <Route element={<HubLayout />}>
                <Route path="/eva-hub" element={<Navigate to="/eva-hub/contas" replace />} />
                <Route path="/eva-hub/contas" element={<HubContas />} />
                <Route path="/eva-hub/workspaces" element={<HubWorkspaces />} />
                <Route path="/eva-hub/membros" element={<HubMembros />} />
                <Route path="/eva-hub/auditoria" element={<HubAuditoria />} />
                <Route path="/eva-hub/meu-whatsapp" element={<HubMeuWhatsApp />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;

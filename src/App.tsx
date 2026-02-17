import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
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
import { GraduationCap, Target, TrendingUp } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="eva-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lancamentos" element={<Lancamentos />} />
                <Route path="/plano-de-caixa" element={<PlanoDeCaixa />} />
                <Route path="/dre" element={<DRE />} />
                <Route path="/precificacao" element={<Precificacao />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/contatos" element={<Contatos />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/eva-kids" element={<ComingSoon title="EVA Kids" description="Educação financeira para crianças. Em breve!" icon={GraduationCap} />} />
                <Route path="/metas" element={<ComingSoon title="Metas" description="Defina e acompanhe suas metas financeiras." icon={Target} />} />
                <Route path="/precificacao-v2" element={<ComingSoon title="Precificação V2" description="FHC completo com custo de vida pessoal integrado." icon={TrendingUp} />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

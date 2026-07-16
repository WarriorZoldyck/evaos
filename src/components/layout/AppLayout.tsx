import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { HeaderSlotProvider, useHeaderSlotContent, useHeaderLeftSlotContent } from "@/contexts/HeaderSlotContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalTransactionModal } from "./GlobalTransactionModal";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionGuard";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { EvaChatButton } from "@/components/chat/EvaChatButton";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <AppLayoutInner />;
}

function AppLayoutInner() {
  const location = useLocation();
  const isOnLancamentos = location.pathname === "/lancamentos";
  const [globalFormOpen, setGlobalFormOpen] = useState(false);

  return (
    <CompanyProvider>
      <HeaderSlotProvider>
        <SidebarProvider>
          <div className="h-screen flex w-full overflow-hidden">
            <AppSidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <AppHeader
                isOnLancamentos={isOnLancamentos}
                onOpenGlobalForm={() => setGlobalFormOpen(true)}
              />
              <SubscriptionBanner />
              <div className={isOnLancamentos ? "flex-1 overflow-auto px-4 pb-4 md:px-6 md:pb-6" : "flex-1 overflow-auto p-4 md:p-6"}>
                <Outlet />
              </div>
            </main>
          </div>
          <GlobalTransactionModal
            open={globalFormOpen}
            onClose={() => setGlobalFormOpen(false)}
          />
          <OnboardingGuide />
          <EvaChatButton />
        </SidebarProvider>
      </HeaderSlotProvider>
    </CompanyProvider>
  );
}

function AppHeader({
  isOnLancamentos,
  onOpenGlobalForm,
}: {
  isOnLancamentos: boolean;
  onOpenGlobalForm: () => void;
}) {
  const { impersonatingOwnerName, impersonatingRole, exitImpersonation } = useHub();
  const slotContent = useHeaderSlotContent();
  const leftSlotContent = useHeaderLeftSlotContent();
  const roleLabel: Record<string, string> = { admin: "Admin", editor: "Editor", viewer: "Leitura" };

  return (
    <header className="h-14 flex items-center justify-between gap-3 border-b border-border/60 px-4 shrink-0 glass-strong sticky top-0 z-40">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors h-9 w-9 md:h-8 md:w-8" />
        {leftSlotContent}
        {impersonatingOwnerName && (
          <Badge
            variant="outline"
            className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 border-primary/40 bg-primary/5"
            onClick={exitImpersonation}
            title="Sair da conta"
          >
            👤 {impersonatingOwnerName}
            {impersonatingRole && (
              <span className="text-[10px] opacity-70 ml-0.5">
                • {roleLabel[impersonatingRole] || impersonatingRole}
              </span>
            )}
            <span className="ml-1">✕</span>
          </Badge>
        )}
      </div>

      {/* Centro: slot injetado pelas páginas (ex.: filtros do Dashboard) */}
      <div className="flex-1 flex justify-center min-w-0 overflow-hidden">
        {slotContent && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {slotContent}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isOnLancamentos && (
          <Button size="sm" className="gap-1.5" onClick={onOpenGlobalForm}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Lançamento</span>
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

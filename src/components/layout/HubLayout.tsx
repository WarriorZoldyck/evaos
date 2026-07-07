import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { HubProvider, useHub } from "@/contexts/HubContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HubSidebar } from "./HubSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeGateScreen } from "@/components/subscription/UpgradeGate";

export default function HubLayout() {
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

  return (
    <HubProvider>
      <HubLayoutInner />
    </HubProvider>
  );
}

function HubLayoutInner() {
  const navigate = useNavigate();
  const { isHubMember, isOwnerWithMembers, pendingInvitationsCount } = useHub();
  const { hubAllowed, isLoading } = usePlanLimits();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hubAllowed && !isHubMember && !isOwnerWithMembers && pendingInvitationsCount === 0) {
    return (
      <UpgradeGateScreen
        title="EVA Hub é exclusivo do plano Família"
        reason="Gerencie múltiplos usuários, workspaces e permissões. Disponível a partir do plano Família."
      />
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <HubSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-4 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors h-9 w-9 md:h-8 md:w-8" />
              {!isHubMember && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>
              )}
              <Badge variant="outline" className="text-[10px] font-semibold tracking-wide uppercase border-primary/30 text-primary">
                Hub
              </Badge>
            </div>
            <ThemeToggle />
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

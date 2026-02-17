import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";


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
    return <Navigate to="/auth" replace />;
  }

  return <AppLayoutInner />;
}

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOnLancamentos = location.pathname === "/lancamentos";

  const handleNewTransaction = () => {
    if (isOnLancamentos) {
      // Dispatch a custom event so the Lancamentos page opens the modal
      window.dispatchEvent(new CustomEvent("open-new-transaction"));
    } else {
      navigate("/lancamentos?new=true");
    }
  };

  return (
    <CompanyProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 flex flex-col min-w-0">
             <header className="h-14 flex items-center justify-between border-b border-border/60 px-4 shrink-0 glass-strong sticky top-0 z-40">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors h-9 w-9 md:h-8 md:w-8" />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleNewTransaction}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Lançamento</span>
                </Button>
                <ThemeToggle />
              </div>
            </header>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </CompanyProvider>
  );
}

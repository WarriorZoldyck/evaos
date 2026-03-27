import { useNavigate } from "react-router-dom";
import { useHub } from "@/contexts/HubContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, LogIn, Loader2, User } from "lucide-react";

export default function HubContas() {
  const { isHubMember, setImpersonation } = useHub();
  const { ownerProfile, availableWorkspaces, loading } = useWorkspaceMembers();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Member view — select workspace to enter
  if (isHubMember) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground">Contas</h1>
          <p className="text-muted-foreground text-sm">Selecione uma conta para acessar</p>
        </div>

        {availableWorkspaces.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma conta disponível. Aguarde um convite.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {availableWorkspaces.map((ws) => (
              <Card key={ws.owner_id} className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{ws.owner_name}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {ws.role === "admin" ? "Administrador" : ws.role === "editor" ? "Editor" : "Visualizador"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setImpersonation(ws.owner_id, ws.owner_name);
                      navigate("/dashboard");
                    }}
                    className="gap-1.5"
                  >
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Owner view — show own account
  const mainCompany = ownerProfile?.companies?.[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-display text-foreground">Contas</h1>
        <p className="text-muted-foreground text-sm">Sua conta principal</p>
      </div>

      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">
                {ownerProfile?.full_name || "Minha Conta"}
              </p>
              {mainCompany ? (
                <p className="text-sm text-muted-foreground">
                  {mainCompany.name} • CNPJ: {mainCompany.cnpj}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Conta pessoal</p>
              )}
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="gap-1.5">
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

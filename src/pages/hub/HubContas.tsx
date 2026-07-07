import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/contexts/HubContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, LogIn, Loader2, User, Shield, Edit3, Eye, LogOut, UserPlus } from "lucide-react";

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "text-amber-500" },
  editor: { label: "Editor", icon: Edit3, color: "text-blue-500" },
  viewer: { label: "Visualizador", icon: Eye, color: "text-muted-foreground" },
};

export default function HubContas() {
  const { isHubMember, setImpersonation } = useHub();
  const {
    ownerProfile,
    availableWorkspaces,
    pendingInvitations,
    acceptInvitation,
    rejectInvitation,
    loading,
  } = useWorkspaceMembers();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingInvitations.length > 0 && !isHubMember) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Convites recebidos</h1>
          <p className="text-muted-foreground text-sm mt-1">Aceite o convite para acessar a conta compartilhada</p>
        </div>

        <div className="grid gap-3">
          {pendingInvitations.map((inv) => {
            const role = roleConfig[inv.role] || roleConfig.viewer;
            const RoleIcon = role.icon;
            return (
              <Card key={inv.member_id} className="border-primary/30 bg-card/60 backdrop-blur-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{inv.owner_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleIcon className={`h-3 w-3 ${role.color}`} />
                        <span className="text-xs text-muted-foreground">Convidou você como {role.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => rejectInvitation(inv.member_id)}>
                      Recusar
                    </Button>
                    <Button size="sm" onClick={() => acceptInvitation(inv.member_id)}>
                      Aceitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Member view
  if (isHubMember) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Contas</h1>
          <p className="text-muted-foreground text-sm mt-1">Selecione uma conta para acessar</p>
        </div>

        {availableWorkspaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Nenhuma conta disponível</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Aguarde um convite do proprietário.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {availableWorkspaces.map((ws) => {
              const role = roleConfig[ws.role] || roleConfig.viewer;
              const RoleIcon = role.icon;
              return (
                <Card
                  key={ws.owner_id}
                  className="hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div
                      className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 cursor-pointer"
                      onClick={() => {
                        setImpersonation(ws.owner_id, ws.owner_name, ws.role);
                        navigate("/dashboard");
                      }}
                    >
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        setImpersonation(ws.owner_id, ws.owner_name, ws.role);
                        navigate("/dashboard");
                      }}
                    >
                      <p className="font-semibold text-foreground truncate">{ws.owner_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleIcon className={`h-3 w-3 ${role.color}`} />
                        <span className="text-xs text-muted-foreground">{role.label}</span>
                      </div>
                    </div>
                    <LeaveAccountButton memberId={ws.member_id} ownerName={ws.owner_name} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Owner view
  const mainCompany = ownerProfile?.companies?.[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Contas</h1>
        <p className="text-muted-foreground text-sm mt-1">Sua conta principal no EVA</p>
      </div>

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="relative pt-0 pb-6 -mt-8">
          <div className="flex items-end gap-4">
            <div className="h-16 w-16 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-lg font-bold text-foreground truncate">
                {ownerProfile?.full_name || "Minha Conta"}
              </h2>
              {mainCompany ? (
                <p className="text-sm text-muted-foreground truncate">
                  {mainCompany.name} • CNPJ: {mainCompany.cnpj}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Conta pessoal</p>
              )}
            </div>
          </div>
          <div className="mt-5">
            <Button onClick={() => navigate("/dashboard")} className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              Entrar na conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveAccountButton({ memberId, ownerName }: { memberId: string; ownerName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    setLoading(true);
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    setLoading(false);
    if (error) toast.error("Erro ao sair da conta");
    else { toast.success("Você saiu da conta"); window.location.reload(); }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => e.stopPropagation()}
          title="Sair desta conta"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair de {ownerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Você perderá o acesso a esta conta. O dono poderá reconvidar você a qualquer momento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleLeave} disabled={loading} className="bg-destructive hover:bg-destructive/90">
            Sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

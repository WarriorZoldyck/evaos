import { useState } from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeGateModal } from "@/components/subscription/UpgradeGate";
import { useWorkspaceMembers, type WorkspaceMember, type Workspace } from "@/hooks/useWorkspaceMembers";
import { MemberPermissionsModal } from "@/components/hub/MemberPermissionsModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, UserPlus, User, Shield, Eye, Edit3,
  Pause, Play, Loader2, UserCheck, UserX, Folder, Trash2, KeyRound,
} from "lucide-react";

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "text-amber-500 bg-amber-500/10" },
  editor: { label: "Editor", icon: Edit3, color: "text-blue-500 bg-blue-500/10" },
  viewer: { label: "Visualizador", icon: Eye, color: "text-muted-foreground bg-muted" },
};

export default function HubMembros() {
  const {
    members, workspaces, loading,
    createMember, updateMemberRole, suspendMember, activateMember, assignMemberToWorkspace,
    deleteMember, resetMemberPassword,
  } = useWorkspaceMembers();
  const [showInvite, setShowInvite] = useState(false);
  const { canCreateHubMember, limits, usage, refetch: refetchLimits } = usePlanLimits();
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const handleInviteClick = () => {
    const check = canCreateHubMember();
    if (!check.ok) { setUpgradeReason(check.reason || "Limite atingido."); return; }
    setShowInvite(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const suspendedCount = members.filter((m) => m.status === "suspended").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Membros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie quem tem acesso à sua conta
          </p>
        </div>
        <Button onClick={handleInviteClick} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Convidar</span>
          <span className="text-[10px] opacity-70 ml-1">({usage.hubMembers}/{limits.max_hub_members})</span>
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{members.length}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <UserCheck className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <UserX className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{suspendedCount}</p>
            <p className="text-[11px] text-muted-foreground">Suspensos</p>
          </CardContent>
        </Card>
      </div>

      {members.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <UserPlus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum membro adicionado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Convide alguém para começar a gerenciar sua equipe.</p>
            <Button onClick={handleInviteClick} className="mt-4 gap-1.5">
              <UserPlus className="h-4 w-4" />
              Convidar primeiro membro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              workspaces={workspaces}
              onUpdateRole={updateMemberRole}
              onSuspend={suspendMember}
              onActivate={activateMember}
              onAssignWorkspace={assignMemberToWorkspace}
              onDelete={deleteMember}
              onResetPassword={resetMemberPassword}
            />
          ))}
        </div>
      )}

      <InviteMemberModal open={showInvite} onClose={() => setShowInvite(false)} onCreate={createMember} />
      <UpgradeGateModal
        open={!!upgradeReason}
        onClose={() => { setUpgradeReason(null); refetchLimits(); }}
        title="Limite de membros atingido"
        reason={upgradeReason || undefined}
      />
    </div>
  );
}

function MemberCard({
  member, workspaces, onUpdateRole, onSuspend, onActivate, onAssignWorkspace,
}: {
  member: WorkspaceMember;
  workspaces: Workspace[];
  onUpdateRole: (id: string, role: string) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onAssignWorkspace: (id: string, wsId: string | null) => void;
}) {
  const role = roleConfig[member.role] || roleConfig.viewer;
  const RoleIcon = role.icon;
  const workspace = workspaces.find((w) => w.id === member.workspace_id);

  return (
    <Card className={`transition-all ${member.status === "suspended" ? "opacity-50" : "hover:border-primary/20 hover:shadow-sm"}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground truncate">{member.member_name}</p>
              <Badge
                variant={member.status === "active" ? "default" : "secondary"}
                className="text-[9px] px-1.5 py-0 h-4 shrink-0"
              >
                {member.status === "active" ? "Ativo" : "Suspenso"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {workspaces.length > 0 && (
            <Select
              value={member.workspace_id || "none"}
              onValueChange={(v) => onAssignWorkspace(member.id, v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px] max-w-[160px]">
                <Folder className="h-3 w-3 mr-1 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem área</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={member.role} onValueChange={(v) => onUpdateRole(member.id, v)}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px] max-w-[160px]">
              <RoleIcon className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Visualizador</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            {member.status === "active" ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onSuspend(member.id)} title="Suspender">
                <Pause className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-500" onClick={() => onActivate(member.id)} title="Reativar">
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteMemberModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, email: string, password: string, role: string) => Promise<any>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !password) return;
    setSaving(true);
    try {
      await onCreate(name, email, password, role);
      setName(""); setEmail(""); setPassword(""); setRole("viewer");
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso" />
          </div>
          <div className="space-y-2">
            <Label>Permissão</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador — Somente leitura</SelectItem>
                <SelectItem value="editor">Editor — Criar e editar</SelectItem>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !email || !password}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Membro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

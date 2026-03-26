import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/contexts/HubContext";
import { useWorkspaceMembers, type WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Edit3,
  LogIn,
  Pause,
  Play,
  Loader2,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Shield className="h-3.5 w-3.5" />,
  editor: <Edit3 className="h-3.5 w-3.5" />,
  viewer: <Eye className="h-3.5 w-3.5" />,
};

export default function EvaHub() {
  const { isHubMember, setImpersonation } = useHub();
  const navigate = useNavigate();

  if (isHubMember) {
    return <MemberWorkspaceSelector />;
  }

  return <OwnerDashboard />;
}

// ──── MEMBER VIEW ────
function MemberWorkspaceSelector() {
  const { availableWorkspaces, loading } = useWorkspaceMembers();
  const { setImpersonation } = useHub();
  const navigate = useNavigate();

  const handleEnter = (ownerId: string, ownerName: string) => {
    setImpersonation(ownerId, ownerName);
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">EVA Hub</h1>
        <p className="text-muted-foreground mt-1">
          Selecione uma área de trabalho para acessar
        </p>
      </div>

      {availableWorkspaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma área de trabalho disponível. Aguarde um convite.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {availableWorkspaces.map((ws) => (
            <Card key={ws.owner_id} className="hover:border-primary/40 transition-colors">
              <CardContent className="flex items-center justify-between py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ws.owner_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {roleIcons[ws.role]}
                        {roleLabels[ws.role]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button onClick={() => handleEnter(ws.owner_id, ws.owner_name)} className="gap-1.5">
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

// ──── OWNER VIEW ────
function OwnerDashboard() {
  const { members, loading, createMember, updateMemberRole, suspendMember, activateMember } = useWorkspaceMembers();
  const [showInvite, setShowInvite] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">EVA Hub</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os membros da sua equipe
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum membro adicionado ainda. Convide alguém para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onUpdateRole={updateMemberRole}
              onSuspend={suspendMember}
              onActivate={activateMember}
            />
          ))}
        </div>
      )}

      <InviteMemberModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreate={createMember}
      />
    </div>
  );
}

function MemberCard({
  member,
  onUpdateRole,
  onSuspend,
  onActivate,
}: {
  member: WorkspaceMember;
  onUpdateRole: (id: string, role: string) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  return (
    <Card className={member.status === "suspended" ? "opacity-60" : ""}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{member.member_name}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={member.role} onValueChange={(v) => onUpdateRole(member.id, v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Visualizador</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant={member.status === "active" ? "default" : "secondary"} className="text-[10px]">
            {member.status === "active" ? "Ativo" : "Suspenso"}
          </Badge>
          {member.status === "active" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSuspend(member.id)}>
              <Pause className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onActivate(member.id)}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InviteMemberModal({
  open,
  onClose,
  onCreate,
}: {
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
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      onClose();
    } catch {
      // error handled in hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso" />
          </div>
          <div>
            <Label>Permissão</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador — Somente leitura</SelectItem>
                <SelectItem value="editor">Editor — Criar e editar lançamentos</SelectItem>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !email || !password}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Criar Membro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

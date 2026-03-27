import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/contexts/HubContext";
import { useWorkspaceMembers, type WorkspaceMember, type Workspace } from "@/hooks/useWorkspaceMembers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  FolderPlus,
  Folder,
  Trash2,
  Building2,
  User,
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
  const { isHubMember } = useHub();

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
      <div className="text-center space-y-2">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground">EVA Hub</h1>
        <p className="text-muted-foreground">
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
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ws.owner_name}</p>
                    <Badge variant="outline" className="text-[10px] gap-1 mt-0.5">
                      {roleIcons[ws.role]}
                      {roleLabels[ws.role]}
                    </Badge>
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
  const {
    members, workspaces, ownerProfile, loading,
    createMember, updateMemberRole, suspendMember, activateMember,
    createWorkspace, deleteWorkspace, assignMemberToWorkspace,
  } = useWorkspaceMembers();
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const mainCompany = ownerProfile?.companies?.[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Header / Profile ── */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display text-foreground truncate">
              {ownerProfile?.full_name || "Minha Conta"}
            </h1>
            {mainCompany ? (
              <p className="text-sm text-muted-foreground truncate">
                {mainCompany.name} • CNPJ: {mainCompany.cnpj}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">EVA Hub — Gestão de equipe</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Workspaces Section ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Áreas de Trabalho
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowCreateWs(true)} className="gap-1.5">
            <FolderPlus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Nenhuma área criada. Crie departamentos para organizar sua equipe.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const count = members.filter((m) => m.workspace_id === ws.id).length;
              return (
                <Card key={ws.id} className="group">
                  <CardContent className="py-4 space-y-1.5 relative">
                    <p className="font-medium text-foreground">{ws.name}</p>
                    {ws.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{ws.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "membro" : "membros"}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => deleteWorkspace(ws.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Members Section ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Membros
          </h2>
          <Button onClick={() => setShowInvite(true)} size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        </div>

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Nenhum membro adicionado. Convide alguém para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                workspaces={workspaces}
                onUpdateRole={updateMemberRole}
                onSuspend={suspendMember}
                onActivate={activateMember}
                onAssignWorkspace={assignMemberToWorkspace}
              />
            ))}
          </div>
        )}
      </section>

      <InviteMemberModal open={showInvite} onClose={() => setShowInvite(false)} onCreate={createMember} />
      <CreateWorkspaceModal open={showCreateWs} onClose={() => setShowCreateWs(false)} onCreate={createWorkspace} />
    </div>
  );
}

// ──── Member Card ────
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
  return (
    <Card className={member.status === "suspended" ? "opacity-60" : ""}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{member.member_name}</p>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workspaces.length > 0 && (
            <Select
              value={member.workspace_id || "none"}
              onValueChange={(v) => onAssignWorkspace(member.id, v === "none" ? null : v)}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
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
            <SelectTrigger className="w-[130px] h-8 text-xs">
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

// ──── Invite Member Modal ────
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
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso" /></div>
          <div>
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

// ──── Create Workspace Modal ────
function CreateWorkspaceModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name) return;
    setSaving(true);
    try {
      await onCreate(name, description || undefined);
      setName(""); setDescription("");
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nova Área de Trabalho</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financeiro, Comercial" /></div>
          <div><Label>Descrição (opcional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da área" rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

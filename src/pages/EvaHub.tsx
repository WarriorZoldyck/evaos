import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/contexts/HubContext";
import { useWorkspaceMembers, type WorkspaceMember, type Workspace } from "@/hooks/useWorkspaceMembers";
import { usePlanLimits } from "@/hooks/usePlanLimits";
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
  const { pendingInvitations, acceptInvitation, rejectInvitation, availableWorkspaces } = useWorkspaceMembers();
  const { hubAllowed } = usePlanLimits();

  const showInvitedSection = availableWorkspaces.length > 0;
  const showOwnerSection = hubAllowed;

  return (
    <div className="space-y-8">
      {pendingInvitations.length > 0 && (
        <div className="max-w-5xl mx-auto space-y-3 animate-fade-in">
          <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Convites recebidos
          </h2>
          <div className="grid gap-3">
            {pendingInvitations.map((inv) => (
              <Card key={inv.member_id} className="border-primary/30 bg-card/60 backdrop-blur-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-primary-soft border border-primary/20 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{inv.owner_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Convidou você como <strong>{roleLabels[inv.role] || inv.role}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => rejectInvitation(inv.member_id)}>
                      Recusar
                    </Button>
                    <Button size="sm" onClick={() => acceptInvitation(inv.member_id)} className="bg-gradient-primary hover:opacity-90">
                      Aceitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showInvitedSection && <InvitedWorkspacesSection />}

      {showOwnerSection ? (
        <OwnerDashboard />
      ) : (
        !showInvitedSection && pendingInvitations.length === 0 && (
          <Card className="max-w-2xl mx-auto border-dashed border-border/60 bg-card/40 backdrop-blur-sm">
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              Você ainda não faz parte de nenhum hub. Aguarde um convite ou faça upgrade do seu plano para criar o seu.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}


// ──── INVITED HUBS SECTION ────
function InvitedWorkspacesSection() {
  const { availableWorkspaces } = useWorkspaceMembers();
  const { setImpersonation } = useHub();
  const navigate = useNavigate();

  const handleEnter = (ownerId: string, ownerName: string, role: string) => {
    setImpersonation(ownerId, ownerName, role);
    navigate("/dashboard");
  };

  return (
    <section className="max-w-5xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Hubs em que sou membro
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Áreas de trabalho de outros usuários às quais você foi convidado
        </p>
      </div>
      <div className="grid gap-3">
        {availableWorkspaces.map((ws) => (
          <Card
            key={ws.owner_id}
            className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_8px_32px_-12px_hsl(var(--primary)/0.35)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="relative flex items-center justify-between py-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-primary-soft border border-primary/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{ws.owner_name}</p>
                  <Badge variant="outline" className="text-[10px] gap-1 mt-1 border-primary/30 text-primary bg-primary/5">
                    {roleIcons[ws.role]}
                    {roleLabels[ws.role]}
                  </Badge>
                </div>
              </div>
              <Button
                onClick={() => handleEnter(ws.owner_id, ws.owner_name, ws.role)}
                className="gap-1.5 bg-gradient-primary hover:opacity-90 shadow-lg shadow-primary/20"
              >
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
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
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* ── Header / Profile ── */}
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-sm">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        <CardContent className="relative flex items-center gap-5 py-7">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-30 blur-lg" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-primary-soft border border-primary/30 flex items-center justify-center glow-primary-sm">
              <User className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-primary/30 text-primary bg-primary/5">
                Proprietário
              </Badge>
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground truncate mt-1.5 tracking-tight">
              {ownerProfile?.full_name || "Minha Conta"}
            </h1>
            {mainCompany ? (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {mainCompany.name} • CNPJ: {mainCompany.cnpj}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">EVA Hub — Gestão de equipe</p>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-right">
            <span className="text-2xl font-bold font-display text-gradient-primary">{members.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {members.length === 1 ? "membro" : "membros"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Workspaces Section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" />
              Áreas de Trabalho
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Departamentos e times da sua organização</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateWs(true)}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
          >
            <FolderPlus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-card/40">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Nenhuma área criada. Crie departamentos para organizar sua equipe.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const count = members.filter((m) => m.workspace_id === ws.id).length;
              return (
                <Card
                  key={ws.id}
                  className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.3)] transition-all duration-300"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="py-4 space-y-2 relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-gradient-primary-soft border border-primary/20 flex items-center justify-center shrink-0">
                        <Folder className="h-4 w-4 text-primary" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteWorkspace(ws.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="font-semibold text-foreground">{ws.name}</p>
                    {ws.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{ws.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "membro" : "membros"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Members Section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Membros
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pessoas com acesso ao seu workspace</p>
          </div>
          <Button
            onClick={() => setShowInvite(true)}
            size="sm"
            className="gap-1.5 bg-gradient-primary hover:opacity-90 shadow-lg shadow-primary/20"
          >
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        </div>

        {members.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-card/40">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
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
    <Card
      className={`group border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.25)] transition-all duration-300 ${
        member.status === "suspended" ? "opacity-60" : ""
      }`}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary-soft border border-primary/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{member.member_name}</p>
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

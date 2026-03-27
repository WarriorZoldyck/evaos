import { useState } from "react";
import { useWorkspaceMembers, type WorkspaceMember, type Workspace } from "@/hooks/useWorkspaceMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, UserPlus, User, Shield, Eye, Edit3,
  Pause, Play, Loader2,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
};

export default function HubMembros() {
  const {
    members, workspaces, loading,
    createMember, updateMemberRole, suspendMember, activateMember, assignMemberToWorkspace,
  } = useWorkspaceMembers();
  const [showInvite, setShowInvite] = useState(false);

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
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Membros
          </h1>
          <p className="text-muted-foreground text-sm">
            {activeCount} ativo{activeCount !== 1 && "s"}
            {suspendedCount > 0 && ` • ${suspendedCount} suspenso${suspendedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Convidar
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
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

      <InviteMemberModal open={showInvite} onClose={() => setShowInvite(false)} onCreate={createMember} />
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

import { useEffect, useState } from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeGateModal } from "@/components/subscription/UpgradeGate";
import { useWorkspaceMembers, type WorkspaceMember, type Workspace } from "@/hooks/useWorkspaceMembers";
import { MemberPermissionsModal } from "@/components/hub/MemberPermissionsModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Building2, Wallet, CreditCard, Landmark, Smartphone,
} from "lucide-react";

type ResourceType = "company" | "bank_account" | "credit_card" | "card_terminal" | "wallet";
interface ResourceOption { id: string; name: string; type: ResourceType }

const RES_META: Record<ResourceType, { label: string; icon: typeof Shield }> = {
  company: { label: "Empresas", icon: Building2 },
  bank_account: { label: "Contas Bancárias", icon: Landmark },
  credit_card: { label: "Cartões de Crédito", icon: CreditCard },
  card_terminal: { label: "Maquininhas", icon: Smartphone },
  wallet: { label: "Carteiras", icon: Wallet },
};
const RES_ORDER: ResourceType[] = ["company", "bank_account", "credit_card", "card_terminal", "wallet"];

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
  member, workspaces, onUpdateRole, onSuspend, onActivate, onAssignWorkspace, onDelete, onResetPassword,
}: {
  member: WorkspaceMember;
  workspaces: Workspace[];
  onUpdateRole: (id: string, role: string) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onAssignWorkspace: (id: string, wsId: string | null) => void;
  onDelete: (id: string) => void;
  onResetPassword: (id: string) => void;
}) {
  const role = roleConfig[member.role] || roleConfig.viewer;
  const RoleIcon = role.icon;
  const [permsOpen, setPermsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
                {member.status === "active" ? "Ativo" : member.status === "pending" ? "Aguardando aceitação" : "Suspenso"}
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
        </div>

        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary" onClick={() => setPermsOpen(true)}>
            <Shield className="h-3 w-3" /> Acesso
          </Button>
          {member.created_by_hub && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => onResetPassword(member.id)} title="Gerar nova senha temporária (apenas para contas criadas por você)">
              <KeyRound className="h-3 w-3" /> Senha
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            {member.status === "active" ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onSuspend(member.id)} title="Suspender">
                <Pause className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-500" onClick={() => onActivate(member.id)} title="Reativar">
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} title="Excluir membro">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <MemberPermissionsModal
          open={permsOpen}
          onClose={() => setPermsOpen(false)}
          memberId={member.id}
          memberName={member.member_name}
        />

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {member.member_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove definitivamente o acesso desse membro à sua conta.
                Os dados criados por ele permanecem na sua conta.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onDelete(member.id); setConfirmDelete(false); }} className="bg-destructive hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function InviteMemberModal({ open, onClose, onCreate, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, email: string, password: string | undefined, role: string) => Promise<any>;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [saving, setSaving] = useState(false);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingRes, setLoadingRes] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingRes(true);
    (async () => {
      const [c, b, cc, ct, w] = await Promise.all([
        supabase.from("companies").select("id, name").eq("user_id", user.id),
        supabase.from("bank_accounts").select("id, name").eq("user_id", user.id),
        supabase.from("credit_cards").select("id, name").eq("user_id", user.id),
        supabase.from("card_terminals").select("id, name").eq("user_id", user.id),
        supabase.from("wallets").select("id, name").eq("user_id", user.id),
      ]);
      const all: ResourceOption[] = [
        ...((c.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "company" as const })),
        ...((b.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "bank_account" as const })),
        ...((cc.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "credit_card" as const })),
        ...((ct.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "card_terminal" as const })),
        ...((w.data as any[]) || []).map((r) => ({ id: r.id, name: r.name, type: "wallet" as const })),
      ];
      setResources(all);
      setLoadingRes(false);
    })();
  }, [open, user]);

  const toggle = (type: ResourceType, id: string) => {
    const key = `${type}:${id}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const reset = () => {
    setName(""); setEmail(""); setPassword(""); setRole("viewer"); setSelected(new Set());
  };

  const handleSubmit = async () => {
    if (!name || !email || !user) return;
    setSaving(true);
    try {
      const res = await onCreate(name, email, password || undefined, role);
      const newUserId: string | undefined = res?.member?.id;

      if (newUserId && selected.size > 0) {
        // Find workspace_members.id for this newly created/invited member
        const { data: wm } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("owner_id", user.id)
          .eq("member_user_id", newUserId)
          .maybeSingle();
        if (wm?.id) {
          const rows = Array.from(selected).map((k) => {
            const [resource_type, resource_id] = k.split(":");
            return { workspace_member_id: wm.id, resource_type, resource_id };
          });
          const { error: permErr } = await supabase
            .from("workspace_member_permissions")
            .insert(rows);
          if (permErr) toast.error("Membro criado, mas falhou ao salvar acesso: " + permErr.message);
          else toast.success(`Acesso configurado para ${rows.length} recurso(s).`);
        }
      }

      reset();
      onCreated?.();
      onClose();
    } catch {
      // toast already handled in onCreate
    } finally { setSaving(false); }
  };

  const hasAnySelection = selected.size > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Apenas se o usuário ainda não tiver conta EVA" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Se o e-mail já tiver conta na EVA, ele receberá um convite para aceitar — a senha não é necessária. Caso contrário, defina uma senha para criar a conta dele.
            </p>
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

          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Acesso a recursos <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              {hasAnySelection && (
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setSelected(new Set())}>
                  Limpar
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hasAnySelection
                ? "O membro verá APENAS os recursos marcados."
                : "Sem nada marcado, o membro verá TUDO da sua conta. Você pode ajustar depois."}
            </p>
            {loadingRes ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
            ) : resources.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum recurso cadastrado ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto rounded-md border border-border/40 p-2">
                {RES_ORDER.map((type) => {
                  const items = resources.filter((r) => r.type === type);
                  if (items.length === 0) return null;
                  const meta = RES_META[type];
                  const Icon = meta.icon;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">{items.length}</Badge>
                      </div>
                      <div className="space-y-0.5 pl-5">
                        {items.map((r) => {
                          const key = `${type}:${r.id}`;
                          return (
                            <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                              <Checkbox
                                checked={selected.has(key)}
                                onCheckedChange={() => toggle(type, r.id)}
                              />
                              <span className="flex-1 truncate">{r.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !email}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Enviar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


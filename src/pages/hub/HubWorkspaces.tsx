import { useState } from "react";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Folder, FolderPlus, Trash2, Loader2, Users,
  LayoutGrid, Calculator, Briefcase, ShoppingCart, Settings,
} from "lucide-react";

const PRESET_DEPARTMENTS = [
  { name: "Financeiro", icon: Calculator },
  { name: "Contabilidade", icon: Briefcase },
  { name: "Comercial", icon: ShoppingCart },
  { name: "Operações", icon: Settings },
  { name: "Administrativo", icon: LayoutGrid },
];

export default function HubWorkspaces() {
  const { workspaces, members, loading, createWorkspace, deleteWorkspace } = useWorkspaceMembers();
  const [showCreate, setShowCreate] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const existingNames = workspaces.map((w) => w.name.toLowerCase());
  const suggestedPresets = PRESET_DEPARTMENTS.filter(
    (p) => !existingNames.includes(p.name.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Áreas de Trabalho</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {workspaces.length} {workspaces.length === 1 ? "departamento criado" : "departamentos criados"}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <FolderPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Criar</span>
        </Button>
      </div>

      {/* Quick presets — only when empty */}
      {suggestedPresets.length > 0 && workspaces.length === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Comece com sugestões prontas</p>
            <p className="text-xs text-muted-foreground">Clique para criar departamentos comuns automaticamente</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestedPresets.map((dept) => {
                const Icon = dept.icon;
                return (
                  <Button
                    key={dept.name}
                    variant="outline"
                    size="sm"
                    onClick={() => createWorkspace(dept.name)}
                    className="gap-1.5 bg-background hover:bg-primary/10 hover:border-primary/30"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {dept.name}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {workspaces.length === 0 && suggestedPresets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Folder className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma área criada</p>
          </CardContent>
        </Card>
      )}

      {workspaces.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => {
            const count = members.filter((m) => m.workspace_id === ws.id).length;
            const preset = PRESET_DEPARTMENTS.find((p) => p.name.toLowerCase() === ws.name.toLowerCase());
            const Icon = preset?.icon || Folder;
            return (
              <Card key={ws.id} className="group hover:border-primary/30 hover:shadow-sm transition-all">
                <CardContent className="py-5 relative">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{ws.name}</p>
                      {ws.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ws.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{count} {count === 1 ? "membro" : "membros"}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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

      <CreateWorkspaceModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={createWorkspace} />
    </div>
  );
}

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
      setName("");
      setDescription("");
      onClose();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Área de Trabalho</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financeiro, Comercial" />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da área" rows={3} />
          </div>
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

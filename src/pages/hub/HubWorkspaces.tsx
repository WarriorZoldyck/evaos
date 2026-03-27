import { useState } from "react";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, FolderPlus, Trash2, Loader2, Users } from "lucide-react";

const PRESET_DEPARTMENTS = [
  "Financeiro",
  "Contabilidade",
  "Comercial",
  "Operações",
  "Administrativo",
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
    (p) => !existingNames.includes(p.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Folder className="h-6 w-6 text-primary" />
            Áreas de Trabalho
          </h1>
          <p className="text-muted-foreground text-sm">Crie departamentos para organizar sua equipe</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <FolderPlus className="h-4 w-4" />
          Criar
        </Button>
      </div>

      {/* Quick presets */}
      {suggestedPresets.length > 0 && workspaces.length === 0 && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Sugestões rápidas</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPresets.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => createWorkspace(name)}
                  className="gap-1.5"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  {name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma área criada. Use as sugestões acima ou crie uma personalizada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const count = members.filter((m) => m.workspace_id === ws.id).length;
            return (
              <Card key={ws.id} className="group">
                <CardContent className="py-4 space-y-2 relative">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary" />
                    <p className="font-medium text-foreground">{ws.name}</p>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{ws.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {count} {count === 1 ? "membro" : "membros"}
                  </div>
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
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financeiro, Comercial" />
          </div>
          <div>
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

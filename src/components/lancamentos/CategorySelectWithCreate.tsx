import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategorySelectWithCreateProps {
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  parentId?: string | null;
  formCompanyId: string | null;
  activeTab: "receita" | "despesa";
  onCategoryCreated: (newId: string) => void;
  label?: string;
  disabled?: boolean;
}

export function CategorySelectWithCreate({
  categories,
  value,
  onChange,
  placeholder = "Selecione",
  parentId = null,
  formCompanyId,
  activeTab,
  onCategoryCreated,
  disabled = false,
}: CategorySelectWithCreateProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [localExtras, setLocalExtras] = useState<CategoryOption[]>([]);

  // Merge passed categories with locally created ones (dedup by id)
  const mergedCategories = (() => {
    const ids = new Set(categories.map((c) => c.id));
    return [...categories, ...localExtras.filter((e) => !ids.has(e.id))];
  })();

  const handleSelectChange = (v: string) => {
    if (v === "__create_new__") {
      setCreateOpen(true);
      return;
    }
    onChange(v);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);

    const type = parentId ? undefined : activeTab;

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: newName.trim(),
        parent_id: parentId || null,
        type: type || "ambos",
        user_id: effectiveUserId,
        // The database validates the parent and derives its context atomically.
        company_id: parentId ? null : (formCompanyId || null),
      })

      .select("id")
      .single();

    setCreating(false);

    if (error) {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Categoria criada!" });
    // Inject locally so the Select shows the name immediately
    setLocalExtras((prev) => [...prev, { id: data.id, name: newName.trim() }]);
    setNewName("");
    setCreateOpen(false);
    onCategoryCreated(data.id);
  };

  return (
    <>
      <Select onValueChange={handleSelectChange} value={value} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {mergedCategories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value="__create_new__" className="text-primary font-medium">
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Criar nova
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              {parentId ? "Criar subcategoria" : "Criar categoria raiz"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da categoria"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full">
              {creating ? "Criando..." : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

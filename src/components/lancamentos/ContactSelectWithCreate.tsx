import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

interface ContactOption {
  id: string;
  name: string;
}

interface ContactSelectWithCreateProps {
  contacts: ContactOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** "supplier" or "client" */
  type: "supplier" | "client";
  onContactCreated: (newId: string) => void;
  disabled?: boolean;
}

export function ContactSelectWithCreate({
  contacts,
  value,
  onChange,
  placeholder = "Selecione",
  type,
  onContactCreated,
  disabled = false,
}: ContactSelectWithCreateProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [localExtras, setLocalExtras] = useState<ContactOption[]>([]);

  const table = type === "supplier" ? "suppliers" : "clients";
  const label = type === "supplier" ? "Fornecedor" : "Cliente";

  // Merge passed contacts with locally created ones (dedup by id)
  const mergedContacts = (() => {
    const ids = new Set(contacts.map((c) => c.id));
    return [...contacts, ...localExtras.filter((e) => !ids.has(e.id))];
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

    const { data, error } = await supabase
      .from(table)
      .insert({
        name: newName.trim(),
        user_id: user.id,
      })
      .select("id")
      .single();

    setCreating(false);

    if (error) {
      toast({ title: `Erro ao criar ${label.toLowerCase()}`, description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${label} criado!` });
    setLocalExtras((prev) => [...prev, { id: data.id, name: newName.trim() }]);
    setNewName("");
    setCreateOpen(false);
    onContactCreated(data.id);
  };

  return (
    <>
      <Select onValueChange={handleSelectChange} value={value} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {mergedContacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value="__create_new__" className="text-primary font-medium">
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Criar novo
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo {label}</DialogTitle>
            <DialogDescription>
              Criar {label.toLowerCase()} rapidamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Nome do ${label.toLowerCase()}`}
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

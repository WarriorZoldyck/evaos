import { useMemo, useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [localExtras, setLocalExtras] = useState<CategoryOption[]>([]);

  // Merge passed categories with locally created ones (dedup by id)
  const mergedCategories = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return [...categories, ...localExtras.filter((e) => !ids.has(e.id))];
  }, [categories, localExtras]);

  // Support legacy or imported values where `value` might be the category name instead of ID
  const selected = mergedCategories.find((c) => c.id === value || c.name === value);

  // Auto-normalize name to ID if it matches by name but we are storing the name
  useEffect(() => {
    if (value && selected && selected.id !== value) {
      onChange(selected.id);
    }
  }, [value, selected, onChange]);

  const openCreate = () => {
    setNewName(search.trim());
    setOpen(false);
    setCreateOpen(true);
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
        company_id: parentId ? null : formCompanyId || null,
      })
      .select("id")
      .single();

    setCreating(false);

    if (error) {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Categoria criada com sucesso!" });
    setLocalExtras((prev) => [...prev, { id: data.id, name: newName.trim() }]);
    setNewName("");
    setSearch("");
    setCreateOpen(false);
    onCategoryCreated(data.id);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal ring-offset-background hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">{selected?.name || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="p-0 w-[--radix-popover-trigger-width] min-w-[240px] z-50 shadow-md border rounded-md bg-popover text-popover-foreground"
        >
          <Command>
            <CommandInput
              placeholder={parentId ? "Buscar subcategoria..." : "Buscar categoria..."}
              className="h-9 text-sm"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[250px] overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-thumb]:rounded-full">
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                Nenhuma categoria encontrada.
              </CommandEmpty>
              <CommandGroup>
                {mergedCategories.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="flex items-center justify-between py-2 text-sm cursor-pointer"
                  >
                    <span className="truncate pr-2">{c.name}</span>
                    {value === c.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={openCreate}
                  className="text-primary font-medium text-sm py-2 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {search.trim() ? `Criar "${search.trim()}"` : "Criar nova categoria"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              {parentId ? "Criar subcategoria" : "Criar categoria raiz"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da categoria"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
                className="mt-1"
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

import { useMemo, useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
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
import { VirtualCommandList } from "@/components/lancamentos/import/VirtualCommandList";

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
  onContactCreated: (newId: string, newName: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ContactSelectWithCreate({
  contacts,
  value,
  onChange,
  placeholder = "Selecione",
  type,
  onContactCreated,
  disabled = false,
  className,
}: ContactSelectWithCreateProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [localExtras, setLocalExtras] = useState<ContactOption[]>([]);

  const table = type === "supplier" ? "suppliers" : "clients";
  const label = type === "supplier" ? "Fornecedor" : "Cliente";

  // Merge passed contacts with locally created ones (dedup by id)
  const mergedContacts = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.id));
    return [...contacts, ...localExtras.filter((e) => !ids.has(e.id))];
  }, [contacts, localExtras]);

  // VirtualCommandList speaks the flat-category shape; contatos não têm
  // hierarquia, então parent_id/type ficam nulos.
  const listItems = useMemo(
    () =>
      mergedContacts.map((c) => ({
        id: c.id,
        name: c.name,
        parent_id: null,
        type: null,
      })),
    [mergedContacts],
  );

  const selected = mergedContacts.find((c) => c.id === value);

  const openCreate = () => {
    // Aproveita o texto já digitado na busca — cria exatamente o que o
    // usuário escreveu, nunca a descrição do extrato.
    setNewName(search.trim());
    setOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from(table)
      .insert({
        name: newName.trim(),
        user_id: effectiveUserId,
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
    setSearch("");
    setCreateOpen(false);
    onContactCreated(data.id, newName.trim());
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
            disabled={disabled}
            className={cn(
              "h-8 text-xs justify-between font-normal px-2 w-full",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selected?.name || placeholder}</span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Buscar ${label.toLowerCase()}...`}
              className="h-8 text-xs"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-4 text-xs">
                Nenhum {label.toLowerCase()} encontrado
              </CommandEmpty>
              {value && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="text-muted-foreground italic text-xs"
                  >
                    — limpar —
                  </CommandItem>
                </CommandGroup>
              )}
              <VirtualCommandList
                items={listItems}
                search={search}
                selectedName={selected?.name || ""}
                selectedId={value}
                onPick={() => {}}
                onPickItem={(c) => {
                  onChange(c.id);
                  setOpen(false);
                  setSearch("");
                }}
              />
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={openCreate}
                  className="text-primary font-medium text-xs"
                >
                  <Plus className="mr-2 h-3 w-3" />
                  {search.trim() ? `Criar "${search.trim()}"` : `Criar novo ${label.toLowerCase()}`}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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

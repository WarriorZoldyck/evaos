import { useMemo, useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
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
import type {
  CategoryFlat,
  RowCategoryValue,
} from "@/components/lancamentos/CategoryPathCombobox";
import { buildCategoryIndex, resolveChain, childrenOfId } from "@/lib/categoryChain";
import { VirtualCommandList } from "./VirtualCommandList";


interface Props {
  categories: CategoryFlat[];
  value: RowCategoryValue | undefined;
  type: "receita" | "despesa";
  onChange: (value: RowCategoryValue) => void;
  onCreateCategory?: (params: {
    name: string;
    parentName?: string;
    type?: "receita" | "despesa";
  }) => Promise<{ id: string; name: string } | null>;
  className?: string;
  /**
   * When true, hide categories whose `type` doesn't match the row (receita/despesa).
   * On the import screen we default to false so every category from the active
   * context is visible — the user decides which one to use.
   */
  strictType?: boolean;
}

function typeAllows(catType: string | null, rowType: "receita" | "despesa") {
  if (!catType) return true;
  const t = catType.toLowerCase();
  return t === "ambos" || t === rowType;
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matches(name: string, search: string): boolean {
  if (!search) return true;
  return normalize(name).includes(normalize(search));
}


export function CategoryCascadeSelect({
  categories,
  value,
  type,
  onChange,
  onCreateCategory,
  className,
  strictType = false,
}: Props) {
  const cat = value?.category || "";
  const sub = value?.subcategory || "";
  const sub2 = value?.subcategory2 || "";

  const index = useMemo(() => buildCategoryIndex(categories), [categories]);

  // Resolve the chain to concrete IDs so we can look up children by parent ID,
  // avoiding collisions between different branches that share the same name.
  const chainIds = useMemo(
    () => resolveChain({ category: cat, subcategory: sub, subcategory2: sub2 }, index),
    [cat, sub, sub2, index],
  );

  const roots = useMemo(
    () =>
      childrenOfId(index, null).filter(
        (c) => !strictType || typeAllows(c.type, type),
      ),
    [index, strictType, type],
  );

  const subs = useMemo(
    () =>
      chainIds.rootId
        ? childrenOfId(index, chainIds.rootId).filter(
            (c) => !strictType || typeAllows(c.type, type),
          )
        : [],
    [index, chainIds.rootId, strictType, type],
  );

  const sub2s = useMemo(
    () =>
      chainIds.subId
        ? childrenOfId(index, chainIds.subId).filter(
            (c) => !strictType || typeAllows(c.type, type),
          )
        : [],
    [index, chainIds.subId, strictType, type],
  );


  const [openLevel, setOpenLevel] = useState<null | "cat" | "sub" | "sub2">(null);
  const [catSearch, setCatSearch] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [sub2Search, setSub2Search] = useState("");
  const [creating, setCreating] = useState<{
    level: "cat" | "sub" | "sub2";
    parentName?: string;
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredRoots = useMemo(
    () => roots.filter((c) => matches(c.name, catSearch)),
    [roots, catSearch],
  );
  const filteredSubs = useMemo(
    () => subs.filter((c) => matches(c.name, subSearch)),
    [subs, subSearch],
  );
  const filteredSub2s = useMemo(
    () => sub2s.filter((c) => matches(c.name, sub2Search)),
    [sub2s, sub2Search],
  );


  const pickCat = (name: string) => {
    onChange({
      category: name,
      subcategory: undefined,
      subcategory2: undefined,
      touched: true,
    });
    setOpenLevel(null);
  };
  const pickSub = (name: string) => {
    onChange({
      category: cat,
      subcategory: name,
      subcategory2: undefined,
      touched: true,
    });
    setOpenLevel(null);
  };
  const pickSub2 = (name: string) => {
    onChange({
      category: cat,
      subcategory: sub,
      subcategory2: name,
      touched: true,
    });
    setOpenLevel(null);
  };

  const clearCat = () => {
    onChange({
      category: "",
      subcategory: undefined,
      subcategory2: undefined,
      touched: true,
    });
    setOpenLevel(null);
  };
  const clearSub = () => {
    onChange({
      category: cat,
      subcategory: undefined,
      subcategory2: undefined,
      touched: true,
    });
    setOpenLevel(null);
  };
  const clearSub2 = () => {
    onChange({
      category: cat,
      subcategory: sub,
      subcategory2: undefined,
      touched: true,
    });
    setOpenLevel(null);
  };

  const openCreate = (level: "cat" | "sub" | "sub2", parentName?: string) => {
    setCreating({ level, parentName });
    setNewName("");
    setOpenLevel(null);
  };

  const doCreate = async () => {
    if (!creating || !onCreateCategory || !newName.trim()) return;
    setBusy(true);
    const created = await onCreateCategory({
      name: newName.trim(),
      parentName: creating.parentName,
      type,
    });
    setBusy(false);
    if (!created) return;
    if (creating.level === "cat") {
      onChange({
        category: created.name,
        subcategory: undefined,
        subcategory2: undefined,
        touched: true,
      });
    } else if (creating.level === "sub") {
      onChange({
        category: cat,
        subcategory: created.name,
        subcategory2: undefined,
        touched: true,
      });
    } else {
      onChange({
        category: cat,
        subcategory: sub,
        subcategory2: created.name,
        touched: true,
      });
    }
    setCreating(null);
    setNewName("");
  };

  const triggerCls =
    "h-8 text-xs justify-between font-normal px-2 w-full";

  const renderTrigger = (
    selected: string,
    placeholder: string,
    disabled?: boolean,
  ) => (
    <Button
      variant="outline"
      role="combobox"
      disabled={disabled}
      className={cn(triggerCls, !selected && "text-muted-foreground")}
    >
      <span className="truncate">{selected || placeholder}</span>
      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <>
      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-1.5", className)}>
        {/* Categoria */}
        <Popover
          open={openLevel === "cat"}
          onOpenChange={(o) => setOpenLevel(o ? "cat" : null)}
        >
          <PopoverTrigger asChild>{renderTrigger(cat, "Categoria")}</PopoverTrigger>
          <PopoverContent
            className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar categoria..."
                className="h-8 text-xs"
                value={catSearch}
                onValueChange={setCatSearch}
              />
              <CommandList className="max-h-[280px]">
                {filteredRoots.length === 0 && (
                  <CommandEmpty className="py-4 text-xs">Nenhuma categoria</CommandEmpty>
                )}
                {cat && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={clearCat}
                        className="text-muted-foreground italic text-xs"
                      >
                        — limpar —
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <VirtualCommandList
                  items={filteredRoots}
                  search=""
                  selectedName={cat}
                  onPick={pickCat}
                />
                {onCreateCategory && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__create__"
                        onSelect={() => openCreate("cat")}
                        className="text-primary font-medium text-xs"
                      >
                        <Plus className="mr-2 h-3 w-3" /> Nova categoria
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>

          </PopoverContent>
        </Popover>

        {/* Subcategoria */}
        <Popover
          open={openLevel === "sub"}
          onOpenChange={(o) => setOpenLevel(o ? "sub" : null)}
        >
          <PopoverTrigger asChild>
            {renderTrigger(sub, cat ? "Subcategoria" : "—", !cat)}
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar subcategoria..."
                className="h-8 text-xs"
                value={subSearch}
                onValueChange={setSubSearch}
              />
              <CommandList className="max-h-[280px]">
                {filteredSubs.length === 0 && (
                  <CommandEmpty className="py-4 text-xs">Nenhuma subcategoria</CommandEmpty>
                )}
                {sub && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={clearSub}
                        className="text-muted-foreground italic text-xs"
                      >
                        — limpar —
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <VirtualCommandList
                  items={filteredSubs}
                  search=""
                  selectedName={sub}
                  onPick={pickSub}
                />
                {onCreateCategory && cat && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__create__"
                        onSelect={() => openCreate("sub", cat)}
                        className="text-primary font-medium text-xs"
                      >
                        <Plus className="mr-2 h-3 w-3" /> Nova subcategoria
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>

          </PopoverContent>
        </Popover>

        {/* Sub-subcategoria */}
        <Popover
          open={openLevel === "sub2"}
          onOpenChange={(o) => setOpenLevel(o ? "sub2" : null)}
        >
          <PopoverTrigger asChild>
            {renderTrigger(sub2, sub ? "Sub-subcategoria" : "—", !sub)}
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar sub-subcategoria..."
                className="h-8 text-xs"
                value={sub2Search}
                onValueChange={setSub2Search}
              />
              <CommandList className="max-h-[280px]">
                {filteredSub2s.length === 0 && (
                  <CommandEmpty className="py-4 text-xs">Nenhum item</CommandEmpty>
                )}
                {sub2 && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={clearSub2}
                        className="text-muted-foreground italic text-xs"
                      >
                        — limpar —
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <VirtualCommandList
                  items={filteredSub2s}
                  search=""
                  selectedName={sub2}
                  onPick={pickSub2}
                />
                {onCreateCategory && sub && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__create__"
                        onSelect={() => openCreate("sub2", sub)}
                        className="text-primary font-medium text-xs"
                      >
                        <Plus className="mr-2 h-3 w-3" /> Nova sub-subcategoria
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>

          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {creating?.level === "cat"
                ? "Nova categoria"
                : creating?.level === "sub"
                ? "Nova subcategoria"
                : "Nova sub-subcategoria"}
            </DialogTitle>
            <DialogDescription>
              {creating?.parentName ? `Em "${creating.parentName}"` : "Categoria raiz"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    doCreate();
                  }
                }}
              />
            </div>
            <Button
              onClick={doCreate}
              disabled={busy || !newName.trim()}
              className="w-full"
            >
              {busy ? "Criando..." : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

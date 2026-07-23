import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface CategoryFlat {
  id: string;
  name: string;
  parent_id: string | null;
  type: string | null;
}

export interface RowCategoryValue {
  category: string;
  subcategory?: string;
  subcategory2?: string;
  touched?: boolean;
}

interface CategoryPathComboboxProps {
  categories: CategoryFlat[];
  value: RowCategoryValue | undefined;
  type: "receita" | "despesa";
  onChange: (value: RowCategoryValue) => void;
  onCreateCategory?: (params: {
    name: string;
    parentName?: string;
    type?: "receita" | "despesa";
  }) => Promise<{ id: string; name: string } | null>;
  placeholder?: string;
  className?: string;
}

interface PathNode {
  path: string[]; // full path names root → leaf
  category: string;
  subcategory?: string;
  subcategory2?: string;
  searchable: string; // normalized concatenation for cmdk
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

export function CategoryPathCombobox({
  categories,
  value,
  type,
  onChange,
  onCreateCategory,
  placeholder = "Selecionar categoria",
  className,
}: CategoryPathComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creatingName, setCreatingName] = useState("");
  const [creatingParent, setCreatingParent] = useState<{
    parentName?: string;
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const paths = useMemo<PathNode[]>(() => {
    const byParent = new Map<string | null, CategoryFlat[]>();
    for (const c of categories) {
      const key = c.parent_id;
      const arr = byParent.get(key) || [];
      arr.push(c);
      byParent.set(key, arr);
    }
    const out: PathNode[] = [];
    const roots = (byParent.get(null) || []).filter((c) => typeAllows(c.type, type));
    for (const root of roots) {
      const rootNode: PathNode = {
        path: [root.name],
        category: root.name,
        searchable: normalize(root.name),
      };
      out.push(rootNode);
      const subs = byParent.get(root.id) || [];
      for (const sub of subs) {
        const subNode: PathNode = {
          path: [root.name, sub.name],
          category: root.name,
          subcategory: sub.name,
          searchable: normalize(`${root.name} ${sub.name}`),
        };
        out.push(subNode);
        const subsubs = byParent.get(sub.id) || [];
        for (const ss of subsubs) {
          out.push({
            path: [root.name, sub.name, ss.name],
            category: root.name,
            subcategory: sub.name,
            subcategory2: ss.name,
            searchable: normalize(`${root.name} ${sub.name} ${ss.name}`),
          });
        }
      }
    }
    return out;
  }, [categories, type]);

  const selectedLabel = (() => {
    if (!value?.category) return null;
    const parts = [value.category, value.subcategory, value.subcategory2].filter(Boolean) as string[];
    return parts;
  })();

  const handleSelect = (node: PathNode) => {
    onChange({
      category: node.category,
      subcategory: node.subcategory,
      subcategory2: node.subcategory2,
      touched: true,
    });
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    onChange({ category: "", subcategory: undefined, subcategory2: undefined, touched: true });
    setOpen(false);
    setQuery("");
  };

  const openCreate = (parentName: string | undefined, label: string, seed?: string) => {
    setCreatingParent({ parentName, label });
    setCreatingName(seed || query);
  };

  const doCreate = async () => {
    if (!onCreateCategory || !creatingName.trim() || !creatingParent) return;
    setBusy(true);
    const created = await onCreateCategory({
      name: creatingName.trim(),
      parentName: creatingParent.parentName,
      type,
    });
    setBusy(false);
    if (!created) return;

    // Auto-select the newly created node at the deepest available level
    if (!creatingParent.parentName) {
      onChange({ category: created.name, subcategory: undefined, subcategory2: undefined, touched: true });
    } else if (value?.category && creatingParent.parentName === value.category) {
      onChange({ category: value.category, subcategory: created.name, subcategory2: undefined, touched: true });
    } else if (value?.subcategory && creatingParent.parentName === value.subcategory) {
      onChange({
        category: value.category,
        subcategory: value.subcategory,
        subcategory2: created.name,
        touched: true,
      });
    }
    setCreatingParent(null);
    setCreatingName("");
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setCreatingParent(null);
          setCreatingName("");
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 w-full justify-between px-2 text-xs font-normal",
            !selectedLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate flex items-center gap-1 min-w-0">
            {selectedLabel ? (
              selectedLabel.map((p, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 min-w-0">
                  {idx > 0 && <span className="opacity-40 shrink-0">›</span>}
                  <span
                    className={cn(
                      "truncate",
                      idx === selectedLabel.length - 1 ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {p}
                  </span>
                </span>
              ))
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          // let cmdk focus its input
          e.preventDefault();
        }}
      >
        {creatingParent ? (
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium">
              Nova {creatingParent.label}
              {creatingParent.parentName && (
                <span className="text-muted-foreground font-normal"> em “{creatingParent.parentName}”</span>
              )}
            </p>
            <Input
              autoFocus
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              placeholder="Nome"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doCreate();
                }
                if (e.key === "Escape") {
                  setCreatingParent(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatingParent(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={doCreate}
                disabled={busy || !creatingName.trim()}
              >
                {busy ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        ) : (
          <Command
            filter={(itemValue, search) => {
              // itemValue is our normalized searchable string
              const n = normalize(search);
              return itemValue.includes(n) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Buscar categoria..."
              value={query}
              onValueChange={setQuery}
              className="h-9"
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty>
                <div className="py-4 px-3 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
                  {onCreateCategory && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => openCreate(undefined, "categoria", query)}
                    >
                      <Plus className="h-3 w-3" /> Criar “{query || "nova"}”
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__clear__ sem categoria"
                  onSelect={handleClear}
                  className="text-xs text-muted-foreground italic"
                >
                  <X className="h-3 w-3 mr-2" /> Sem categoria
                </CommandItem>
                {paths.map((node, idx) => {
                  const isSelected =
                    value?.category === node.category &&
                    (value?.subcategory ?? undefined) === (node.subcategory ?? undefined) &&
                    (value?.subcategory2 ?? undefined) === (node.subcategory2 ?? undefined);
                  return (
                    <CommandItem
                      key={`${node.path.join("|")}-${idx}`}
                      value={node.searchable}
                      onSelect={() => handleSelect(node)}
                      className="text-xs"
                    >
                      <Check
                        className={cn("h-3 w-3 mr-2 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex items-center gap-1 min-w-0 flex-wrap">
                        {node.path.map((p, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            {i > 0 && <span className="opacity-40">›</span>}
                            <span
                              className={cn(
                                i === node.path.length - 1
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {p}
                            </span>
                          </span>
                        ))}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {onCreateCategory && (
              <div className="border-t p-1.5 flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => openCreate(undefined, "categoria")}
                >
                  <Plus className="h-3 w-3" /> Nova categoria
                </Button>
                {value?.category && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => openCreate(value.category, "subcategoria")}
                  >
                    <Plus className="h-3 w-3" /> Sub em “{value.category}”
                  </Button>
                )}
                {value?.subcategory && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => openCreate(value.subcategory, "sub-subcategoria")}
                  >
                    <Plus className="h-3 w-3" /> Sub-sub em “{value.subcategory}”
                  </Button>
                )}
              </div>
            )}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

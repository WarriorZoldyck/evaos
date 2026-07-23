import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, ChevronsUpDown, CornerDownLeft, Plus, X } from "lucide-react";

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
  path: string[];
  category: string;
  subcategory?: string;
  subcategory2?: string;
  searchable: string;
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
  const [navPath, setNavPath] = useState<string[]>([]);
  const [creatingName, setCreatingName] = useState("");
  const [creatingParent, setCreatingParent] = useState<{
    parentName?: string;
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Build parent → children map and flattened paths (used only for search)
  const { byParent, roots, paths } = useMemo(() => {
    const map = new Map<string | null, CategoryFlat[]>();
    for (const c of categories) {
      const arr = map.get(c.parent_id) || [];
      arr.push(c);
      map.set(c.parent_id, arr);
    }
    const rootList = (map.get(null) || []).filter((c) => typeAllows(c.type, type));
    const flat: PathNode[] = [];
    for (const root of rootList) {
      flat.push({
        path: [root.name],
        category: root.name,
        searchable: normalize(root.name),
      });
      const subs = map.get(root.id) || [];
      for (const sub of subs) {
        flat.push({
          path: [root.name, sub.name],
          category: root.name,
          subcategory: sub.name,
          searchable: normalize(`${root.name} ${sub.name}`),
        });
        const subsubs = map.get(sub.id) || [];
        for (const ss of subsubs) {
          flat.push({
            path: [root.name, sub.name, ss.name],
            category: root.name,
            subcategory: sub.name,
            subcategory2: ss.name,
            searchable: normalize(`${root.name} ${sub.name} ${ss.name}`),
          });
        }
      }
    }
    return { byParent: map, roots: rootList, paths: flat };
  }, [categories, type]);

  // Resolve current level's items based on navPath (names)
  const currentLevel = useMemo(() => {
    let parents = roots;
    let parentNode: CategoryFlat | null = null;
    for (const name of navPath) {
      const match = parents.find((p) => p.name === name);
      if (!match) return { items: [] as CategoryFlat[], parentNode: null };
      parentNode = match;
      parents = (byParent.get(match.id) || []).filter((c) => typeAllows(c.type, type));
    }
    return { items: parents, parentNode };
  }, [navPath, roots, byParent, type]);

  // When opening, position navigation on the selected value's parent level
  useEffect(() => {
    if (!open) return;
    if (value?.category) {
      const initial: string[] = [value.category];
      if (value.subcategory) initial.push(value.subcategory);
      // Show the deepest level whose children are the siblings of the leaf.
      // If leaf is subcategory2 → nav = [category, subcategory]
      // If leaf is subcategory → nav = [category]
      // If leaf is category → nav = []
      const navInit = value.subcategory2
        ? [value.category, value.subcategory!]
        : value.subcategory
        ? [value.category]
        : [];
      setNavPath(navInit);
    } else {
      setNavPath([]);
    }
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedLabel = (() => {
    if (!value?.category) return null;
    return [value.category, value.subcategory, value.subcategory2].filter(Boolean) as string[];
  })();

  const commitPath = (pathNames: string[]) => {
    onChange({
      category: pathNames[0] || "",
      subcategory: pathNames[1],
      subcategory2: pathNames[2],
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

    const parentName = creatingParent.parentName;
    if (!parentName) {
      commitPath([created.name]);
    } else {
      // Determine level of parent to build full path
      // Look up parent in categories
      const parentCat = categories.find((c) => c.name === parentName);
      if (parentCat?.parent_id == null) {
        commitPath([parentName, created.name]);
      } else {
        const grand = categories.find((c) => c.id === parentCat.parent_id);
        commitPath([grand?.name || "", parentName, created.name]);
      }
    }
    setCreatingParent(null);
    setCreatingName("");
  };

  const isSearching = query.trim().length > 0;
  const currentParentName = navPath[navPath.length - 1];
  const currentDepth = navPath.length; // 0=root, 1=sub, 2=subsub
  const createLabel = currentDepth === 0 ? "categoria" : currentDepth === 1 ? "subcategoria" : "sub-subcategoria";

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setCreatingParent(null);
          setCreatingName("");
          setQuery("");
          setNavPath([]);
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
            {!isSearching && navPath.length > 0 && (
              <div className="flex items-center gap-1 border-b px-2 py-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setNavPath((p) => p.slice(0, -1))}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <div className="flex items-center gap-1 text-xs min-w-0 flex-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground truncate"
                    onClick={() => setNavPath([])}
                  >
                    Todas
                  </button>
                  {navPath.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1 min-w-0">
                      <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />
                      <button
                        type="button"
                        className={cn(
                          "truncate",
                          i === navPath.length - 1
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setNavPath((p) => p.slice(0, i + 1))}
                      >
                        {name}
                      </button>
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => commitPath(navPath)}
                  title="Usar este nível como categoria"
                >
                  <CornerDownLeft className="h-3 w-3" /> usar
                </Button>
              </div>
            )}
            <CommandList className="max-h-[280px]">
              <CommandEmpty>
                <div className="py-4 px-3 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
                  {onCreateCategory && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => openCreate(currentParentName, createLabel, query)}
                    >
                      <Plus className="h-3 w-3" /> Criar “{query || "nova"}”
                      {currentParentName && (
                        <span className="text-muted-foreground"> em “{currentParentName}”</span>
                      )}
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

                {isSearching
                  ? paths.map((node, idx) => {
                      const isSelected =
                        value?.category === node.category &&
                        (value?.subcategory ?? undefined) === (node.subcategory ?? undefined) &&
                        (value?.subcategory2 ?? undefined) === (node.subcategory2 ?? undefined);
                      return (
                        <CommandItem
                          key={`${node.path.join("|")}-${idx}`}
                          value={node.searchable}
                          onSelect={() => commitPath(node.path)}
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
                    })
                  : currentLevel.items.map((item) => {
                      const children = (byParent.get(item.id) || []).filter((c) => typeAllows(c.type, type));
                      const hasChildren = children.length > 0 && navPath.length < 2;
                      const fullPath = [...navPath, item.name];
                      const isSelected =
                        value?.category === fullPath[0] &&
                        (value?.subcategory ?? undefined) === (fullPath[1] ?? undefined) &&
                        (value?.subcategory2 ?? undefined) === (fullPath[2] ?? undefined);
                      return (
                        <CommandItem
                          key={item.id}
                          value={normalize(item.name)}
                          onSelect={() => {
                            if (hasChildren) {
                              setNavPath(fullPath);
                            } else {
                              commitPath(fullPath);
                            }
                          }}
                          className="text-xs"
                        >
                          <Check
                            className={cn("h-3 w-3 mr-2 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                          />
                          <span className="flex-1 truncate font-medium text-foreground">{item.name}</span>
                          {hasChildren && (
                            <button
                              type="button"
                              className="ml-1 text-[10px] text-muted-foreground hover:text-foreground px-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitPath(fullPath);
                              }}
                              title="Escolher este nível"
                            >
                              usar
                            </button>
                          )}
                          {hasChildren ? (
                            <ChevronRight className="h-3.5 w-3.5 opacity-50 ml-1 shrink-0" />
                          ) : (
                            <span className="w-3.5 ml-1" />
                          )}
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
                  onClick={() => openCreate(currentParentName, createLabel)}
                >
                  <Plus className="h-3 w-3" />{" "}
                  {currentParentName ? `Nova ${createLabel} em “${currentParentName}”` : "Nova categoria"}
                </Button>
              </div>
            )}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

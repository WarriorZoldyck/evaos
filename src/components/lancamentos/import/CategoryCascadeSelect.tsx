import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type {
  CategoryFlat,
  RowCategoryValue,
} from "@/components/lancamentos/CategoryPathCombobox";

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
}

function typeAllows(catType: string | null, rowType: "receita" | "despesa") {
  if (!catType) return true;
  const t = catType.toLowerCase();
  return t === "ambos" || t === rowType;
}

const CREATE_TOKEN = "__create_new__";
const CLEAR_TOKEN = "__clear__";

export function CategoryCascadeSelect({
  categories,
  value,
  type,
  onChange,
  onCreateCategory,
  className,
}: Props) {
  const cat = value?.category || "";
  const sub = value?.subcategory || "";
  const sub2 = value?.subcategory2 || "";

  const { roots, subsOf, sub2sOf } = useMemo(() => {
    const byParent = new Map<string | null, CategoryFlat[]>();
    for (const c of categories) {
      const arr = byParent.get(c.parent_id) || [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    }
    const rootList = (byParent.get(null) || []).filter((c) => typeAllows(c.type, type));
    const subsFor = (parentName: string) => {
      const parent = rootList.find((r) => r.name === parentName);
      if (!parent) return [];
      return (byParent.get(parent.id) || []).filter((c) => typeAllows(c.type, type));
    };
    const sub2sFor = (parentName: string, subName: string) => {
      const subs = subsFor(parentName);
      const subCat = subs.find((s) => s.name === subName);
      if (!subCat) return [];
      return (byParent.get(subCat.id) || []).filter((c) => typeAllows(c.type, type));
    };
    return { roots: rootList, subsOf: subsFor, sub2sOf: sub2sFor };
  }, [categories, type]);

  const subs = cat ? subsOf(cat) : [];
  const sub2s = cat && sub ? sub2sOf(cat, sub) : [];

  const [creating, setCreating] = useState<{
    level: "cat" | "sub" | "sub2";
    parentName?: string;
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCat = (v: string) => {
    if (v === CREATE_TOKEN) {
      setCreating({ level: "cat" });
      setNewName("");
      return;
    }
    if (v === CLEAR_TOKEN) {
      onChange({ category: "", subcategory: undefined, subcategory2: undefined, touched: true });
      return;
    }
    onChange({ category: v, subcategory: undefined, subcategory2: undefined, touched: true });
  };

  const handleSub = (v: string) => {
    if (v === CREATE_TOKEN) {
      setCreating({ level: "sub", parentName: cat });
      setNewName("");
      return;
    }
    if (v === CLEAR_TOKEN) {
      onChange({ category: cat, subcategory: undefined, subcategory2: undefined, touched: true });
      return;
    }
    onChange({ category: cat, subcategory: v, subcategory2: undefined, touched: true });
  };

  const handleSub2 = (v: string) => {
    if (v === CREATE_TOKEN) {
      setCreating({ level: "sub2", parentName: sub });
      setNewName("");
      return;
    }
    if (v === CLEAR_TOKEN) {
      onChange({ category: cat, subcategory: sub, subcategory2: undefined, touched: true });
      return;
    }
    onChange({ category: cat, subcategory: sub, subcategory2: v, touched: true });
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
      onChange({ category: created.name, subcategory: undefined, subcategory2: undefined, touched: true });
    } else if (creating.level === "sub") {
      onChange({ category: cat, subcategory: created.name, subcategory2: undefined, touched: true });
    } else {
      onChange({ category: cat, subcategory: sub, subcategory2: created.name, touched: true });
    }
    setCreating(null);
    setNewName("");
  };

  const trigger = "h-8 text-xs";

  return (
    <>
      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-1.5", className)}>
        <Select value={cat || undefined} onValueChange={handleCat}>
          <SelectTrigger className={trigger}>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {cat && (
              <SelectItem value={CLEAR_TOKEN} className="text-muted-foreground italic text-xs">
                — limpar —
              </SelectItem>
            )}
            {roots.map((c) => (
              <SelectItem key={c.id} value={c.name} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
            {onCreateCategory && (
              <SelectItem value={CREATE_TOKEN} className="text-primary font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" /> Nova categoria
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <Select value={sub || undefined} onValueChange={handleSub} disabled={!cat}>
          <SelectTrigger className={trigger}>
            <SelectValue placeholder={cat ? "Subcategoria" : "—"} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {sub && (
              <SelectItem value={CLEAR_TOKEN} className="text-muted-foreground italic text-xs">
                — limpar —
              </SelectItem>
            )}
            {subs.map((c) => (
              <SelectItem key={c.id} value={c.name} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
            {onCreateCategory && cat && (
              <SelectItem value={CREATE_TOKEN} className="text-primary font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" /> Nova subcategoria
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <Select value={sub2 || undefined} onValueChange={handleSub2} disabled={!sub}>
          <SelectTrigger className={trigger}>
            <SelectValue placeholder={sub ? "Sub-subcategoria" : "—"} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {sub2 && (
              <SelectItem value={CLEAR_TOKEN} className="text-muted-foreground italic text-xs">
                — limpar —
              </SelectItem>
            )}
            {sub2s.map((c) => (
              <SelectItem key={c.id} value={c.name} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
            {onCreateCategory && sub && (
              <SelectItem value={CREATE_TOKEN} className="text-primary font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" /> Nova sub-subcategoria
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
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
            <Button onClick={doCreate} disabled={busy || !newName.trim()} className="w-full">
              {busy ? "Criando..." : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

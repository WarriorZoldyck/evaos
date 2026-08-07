import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, TrendingUp, TrendingDown } from "lucide-react";
import { useCategories, type Category } from "@/hooks/useCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { CategoryFormModal } from "@/components/categorias/CategoryFormModal";
import { CategoryTreeItem } from "@/components/categorias/CategoryTreeItem";
import { Skeleton } from "@/components/ui/skeleton";

export default function Categorias() {
  const { isPersonal } = useCompany();
  const {
    categories, tree, orphans, loading, search, setSearch,
    createCategory, updateCategory, moveCategory, deleteCategory,
  } = useCategories();


  const [formOpen, setFormOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | undefined>();
  const [editData, setEditData] = useState<{ id: string; name: string; type: string | null; dre_section?: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [defaultType, setDefaultType] = useState("receita");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Listen for native drag events from CategoryTreeItem
  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDraggedId(detail.id);
    };
    const onEnd = () => setDraggedId(null);

    window.addEventListener("category-drag-start", onStart);
    window.addEventListener("category-drag-end", onEnd);
    return () => {
      window.removeEventListener("category-drag-start", onStart);
      window.removeEventListener("category-drag-end", onEnd);
    };
  }, []);

  const openCreateRoot = (type: string) => {
    setParentId(null);
    setParentName(undefined);
    setEditData(null);
    setDefaultType(type);
    setFormOpen(true);
  };

  // Inline add
  const [inlineType, setInlineType] = useState<string>("receita");
  const [inlineName, setInlineName] = useState("");

  const handleInlineAdd = async () => {
    if (!inlineName.trim()) return;
    const success = await createCategory({ name: inlineName.trim(), type: inlineType });
    if (success) setInlineName("");
  };

  const openCreateChild = (pId: string, pName: string) => {
    setParentId(pId);
    setParentName(pName);
    setEditData(null);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditData({ id: cat.id, name: cat.name, type: cat.type, dre_section: cat.dre_section });
    setParentId(null);
    setParentName(undefined);
    setFormOpen(true);
  };

  const handleSave = async (data: { name: string; type?: string; dre_section?: string | null }) => {
    if (editData) {
      return updateCategory(editData.id, data);
    }
    return createCategory({ name: data.name, parent_id: parentId, type: data.type, dre_section: data.dre_section });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Handle drop from native drag & drop
  const handleDrop = useCallback(async (droppedId: string, targetId: string | null, mode: "inside" | "before" | "after") => {
    if (!targetId) return;

    if (mode === "inside") {
      // Make droppedId a child of targetId
      await moveCategory(droppedId, targetId);
    } else {
      // "before" or "after": place at same level as target
      const targetCat = categories.find(c => c.id === targetId);
      if (!targetCat) return;
      const parentOfTarget = targetCat.parent_id;
      const siblings = categories
        .filter(c => c.parent_id === parentOfTarget && c.id !== droppedId)
        .sort((a, b) => a.sort_order - b.sort_order);
      const targetIndex = siblings.findIndex(c => c.id === targetId);
      const insertAt = mode === "before" ? targetIndex : targetIndex + 1;
      await moveCategory(droppedId, parentOfTarget, insertAt);
    }
  }, [categories, moveCategory]);

  // Handle drop on root zone
  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData("text/plain");
    if (!droppedId) return;
    moveCategory(droppedId, null);
  }, [moveCategory]);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Split tree into revenue and expense
  const revenueTree = tree.filter(cat => cat.type === "receita" || cat.type === "ambos");
  const expenseTree = tree.filter(cat => cat.type === "despesa" || cat.type === "ambos");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Categorias</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Organize receitas e despesas em até 3 níveis. Arraste para reorganizar — {isPersonal ? "Pessoal" : "Empresa"}
        </p>
      </div>

      {/* Inline Add + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <Select value={inlineType} onValueChange={setInlineType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Novo grupo principal..."
            value={inlineName}
            onChange={(e) => setInlineName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInlineAdd()}
            className="flex-1"
          />
          <Button onClick={handleInlineAdd} disabled={!inlineName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categorias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div
                  className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  onClick={() => openCreateRoot("receita")}
                  title="Criar categoria de receita"
                >
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                Canais de Receita
                {revenueTree.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {revenueTree.length} grupo{revenueTree.length !== 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                onDrop={handleRootDrop}
                onDragOver={handleRootDragOver}
                className={`min-h-[60px] transition-colors rounded-md ${draggedId ? "ring-1 ring-dashed ring-primary/20" : ""}`}
              >
                {revenueTree.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                    {search ? "Nenhuma encontrada" : "Nenhuma categoria de receita"}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {revenueTree.map((cat) => (
                      <CategoryTreeItem
                        key={cat.id}
                        category={cat}
                        level={0}
                        onAdd={openCreateChild}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onDrop={handleDrop}
                        draggedId={draggedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expense Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div
                  className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
                  onClick={() => openCreateRoot("despesa")}
                  title="Criar categoria de despesa"
                >
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                Centros de Despesa
                {expenseTree.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {expenseTree.length} grupo{expenseTree.length !== 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                onDrop={handleRootDrop}
                onDragOver={handleRootDragOver}
                className={`min-h-[60px] transition-colors rounded-md ${draggedId ? "ring-1 ring-dashed ring-primary/20" : ""}`}
              >
                {expenseTree.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                    {search ? "Nenhuma encontrada" : "Nenhuma categoria de despesa"}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {expenseTree.map((cat) => (
                      <CategoryTreeItem
                        key={cat.id}
                        category={cat}
                        level={0}
                        onAdd={openCreateChild}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onDrop={handleDrop}
                        draggedId={draggedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Form Modal */}
      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        parentName={parentName}
        editData={editData}
        defaultType={defaultType}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Subcategorias devem ser excluídas primeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

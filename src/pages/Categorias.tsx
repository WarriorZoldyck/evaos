import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { FolderTree, Plus, Search } from "lucide-react";
import { useCategories, type Category } from "@/hooks/useCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { CategoryFormModal } from "@/components/categorias/CategoryFormModal";
import { CategoryTreeItem } from "@/components/categorias/CategoryTreeItem";
import { Skeleton } from "@/components/ui/skeleton";

export default function Categorias() {
  const { isPersonal } = useCompany();
  const {
    tree, loading, search, setSearch,
    createCategory, updateCategory, deleteCategory,
  } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | undefined>();
  const [editData, setEditData] = useState<{ id: string; name: string; type: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const openCreateRoot = () => {
    setParentId(null);
    setParentName(undefined);
    setEditData(null);
    setFormOpen(true);
  };

  const openCreateChild = (pId: string, pName: string) => {
    setParentId(pId);
    setParentName(pName);
    setEditData(null);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditData({ id: cat.id, name: cat.name, type: cat.type });
    setParentId(null);
    setParentName(undefined);
    setFormOpen(true);
  };

  const handleSave = async (data: { name: string; type?: string }) => {
    if (editData) {
      return updateCategory(editData.id, data);
    }
    return createCategory({ name: data.name, parent_id: parentId, type: data.type });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organize receitas e despesas em até 3 níveis — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button onClick={openCreateRoot} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categorias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <FolderTree className="h-8 w-8 opacity-50" />
              {search ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {tree.map((cat) => (
                <CategoryTreeItem
                  key={cat.id}
                  category={cat}
                  level={0}
                  onAdd={openCreateChild}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        parentName={parentName}
        editData={editData}
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

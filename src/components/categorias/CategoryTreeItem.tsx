import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, FolderTree, Folder, FileText } from "lucide-react";
import type { Category } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

interface CategoryTreeItemProps {
  category: Category;
  level: number;
  maxLevel?: number;
  onAdd: (parentId: string, parentName: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryTreeItem({
  category,
  level,
  maxLevel = 3,
  onAdd,
  onEdit,
  onDelete,
}: CategoryTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = category.children && category.children.length > 0;
  const canAddChild = level < maxLevel;

  const countAllDescendants = (cat: typeof category): number => {
    if (!cat.children || cat.children.length === 0) return 0;
    return cat.children.reduce((acc, child) => acc + 1 + countAllDescendants(child), 0);
  };
  const totalDescendants = countAllDescendants(category);

  const Icon = level === 0 ? FolderTree : level === 1 ? Folder : FileText;
  const typeLabels: Record<string, string> = { receita: "Receita", despesa: "Despesa", ambos: "Ambos" };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors",
          level > 0 && "ml-6"
        )}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn("h-5 w-5 shrink-0 flex items-center justify-center", !hasChildren && "invisible")}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <Icon className="h-4 w-4 text-primary shrink-0" />

        <span className="flex-1 text-sm font-medium truncate">{category.name}</span>

        {level === 0 && category.type && (
          <Badge variant="outline" className="text-xs shrink-0">
            {typeLabels[category.type] || category.type}
          </Badge>
        )}

        {totalDescendants > 0 && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {totalDescendants} sub-{totalDescendants === 1 ? "item" : "itens"}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAdd(category.id, category.name)}
              title="Adicionar subcategoria"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(category)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              maxLevel={maxLevel}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

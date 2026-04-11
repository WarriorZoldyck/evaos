import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, FolderOpen, Folder, FileText, GripVertical } from "lucide-react";
import type { Category } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

interface CategoryTreeItemProps {
  category: Category;
  level: number;
  maxLevel?: number;
  onAdd: (parentId: string, parentName: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onDrop: (draggedId: string, targetId: string | null, mode: "inside" | "before" | "after") => void;
  draggedId: string | null;
}

export function CategoryTreeItem({
  category,
  level,
  maxLevel = 3,
  onAdd,
  onEdit,
  onDelete,
  onDrop,
  draggedId,
}: CategoryTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [dropZone, setDropZone] = useState<"before" | "inside" | "after" | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChildren = category.children && category.children.length > 0;
  const canAddChild = level < maxLevel - 1;
  const isDragged = draggedId === category.id;

  const countAllDescendants = (cat: Category): number => {
    if (!cat.children || cat.children.length === 0) return 0;
    return cat.children.reduce((acc, child) => acc + 1 + countAllDescendants(child), 0);
  };
  const totalDescendants = countAllDescendants(category);

  const Icon = expanded && hasChildren ? FolderOpen : level < 2 ? Folder : FileText;
  const typeLabels: Record<string, string> = { receita: "Receita", despesa: "Despesa", ambos: "Ambos" };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", category.id);
    e.dataTransfer.effectAllowed = "move";
    // Custom drag event for parent
    const event = new CustomEvent("category-drag-start", { detail: { id: category.id } });
    window.dispatchEvent(event);
  }, [category.id]);

  const handleDragEnd = useCallback(() => {
    setDropZone(null);
    const event = new CustomEvent("category-drag-end");
    window.dispatchEvent(event);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragged || !draggedId) return;

    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const height = rect.height;
    const topZone = height * 0.25;
    const bottomZone = height * 0.75;

    if (y < topZone) {
      setDropZone("before");
    } else if (y > bottomZone) {
      setDropZone("after");
    } else {
      setDropZone("inside");
      // Auto-expand on hover
      if (!expanded && hasChildren && !hoverTimerRef.current) {
        hoverTimerRef.current = setTimeout(() => {
          setExpanded(true);
          hoverTimerRef.current = null;
        }, 600);
      }
    }
  }, [isDragged, draggedId, expanded, hasChildren]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the actual element (not entering a child)
    const relatedTarget = e.relatedTarget as Node | null;
    if (rowRef.current && relatedTarget && rowRef.current.contains(relatedTarget)) return;
    setDropZone(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedId = e.dataTransfer.getData("text/plain");
    if (!droppedId || droppedId === category.id) return;

    const mode = dropZone || "inside";
    onDrop(droppedId, category.id, mode);
    setDropZone(null);
  }, [category.id, dropZone, onDrop]);

  return (
    <div className={cn(isDragged && "opacity-30")}>
      {/* Before drop indicator */}
      {dropZone === "before" && (
        <div className={cn("h-0.5 bg-primary rounded-full mx-2", level > 0 && "ml-8")} />
      )}

      <div
        ref={rowRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-md transition-all cursor-grab active:cursor-grabbing",
          level > 0 && "ml-6",
          dropZone === "inside" && "bg-primary/10 ring-2 ring-primary/30 ring-inset",
          !dropZone && "hover:bg-accent/50",
        )}
      >
        {/* Drag handle */}
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={cn("h-5 w-5 shrink-0 flex items-center justify-center", !hasChildren && "invisible")}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <Icon className={cn("h-4 w-4 shrink-0", dropZone === "inside" ? "text-primary" : "text-primary/70")} />

        <span className="flex-1 text-sm font-medium truncate">{category.name}</span>

        {level === 0 && category.type && (
          <Badge variant="outline" className="text-xs shrink-0">
            {typeLabels[category.type] || category.type}
          </Badge>
        )}

        {category.dre_section && (
          <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">
            DRE
          </Badge>
        )}

        {totalDescendants > 0 && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {totalDescendants}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onAdd(category.id, category.name); }}
              title="Adicionar subcategoria"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onEdit(category); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(category); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* After drop indicator */}
      {dropZone === "after" && !expanded && (
        <div className={cn("h-0.5 bg-primary rounded-full mx-2", level > 0 && "ml-8")} />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="transition-all">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              maxLevel={maxLevel}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onDrop={onDrop}
              draggedId={draggedId}
            />
          ))}
        </div>
      )}

      {/* Drop zone after expanded children (to allow dropping at end of list) */}
      {dropZone === "after" && expanded && (
        <div className={cn("h-0.5 bg-primary rounded-full mx-2", level > 0 && "ml-8")} />
      )}
    </div>
  );
}

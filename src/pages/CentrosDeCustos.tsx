import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronDown, FolderOpen, Folder, GripVertical, Layers } from "lucide-react";
import { useCategories, type Category } from "@/hooks/useCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const DRE_SECTIONS = [
  { key: "receita_operacional", label: "Receita Operacional", sign: "+" },
  { key: "impostos_venda", label: "Impostos sobre Venda", sign: "-" },
  { key: "cmv_csp", label: "CMV / CSP", sign: "-" },
  { key: "despesas_operacionais", label: "Despesas Operacionais", sign: "-" },
  { key: "despesas_financeiras", label: "Despesas Financeiras", sign: "-" },
  { key: "receita_financeira", label: "Receita Financeira", sign: "+" },
  { key: "despesas_vendas", label: "Despesas com Vendas", sign: "-" },
  { key: "despesas_gerais", label: "Despesas Gerais", sign: "-" },
  { key: "mdr", label: "Taxas MDR", sign: "-" },
] as const;

export default function CentrosDeCustos() {
  const { isPersonal } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { categories, loading, refetch } = useCategories();
  const { settings, updateField } = useFormFieldSettings();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    receita_operacional: true,
    despesas_operacionais: true,
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const mdrEnabled = (settings as any).mdr_cost_center_enabled ?? false;

  const toggleMdr = async (checked: boolean) => {
    if (!user) return;
    const updated = { ...settings, mdr_cost_center_enabled: checked } as any;
    await supabase.from("profiles").update({ transaction_form_fields: updated }).eq("id", user.id);
    // If disabling, remove mdr section from categories
    if (!checked) {
      const mdrCats = categories.filter(c => c.dre_section === "mdr");
      for (const cat of mdrCats) {
        await supabase.from("categories").update({ dre_section: null }).eq("id", cat.id);
      }
      refetch();
    }
    // Force re-render by updating field
    updateField("mdr_cost_center_enabled" as any, checked);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Listen for drag events
  useEffect(() => {
    const onStart = (e: Event) => setDraggedId((e as CustomEvent).detail.id);
    const onEnd = () => setDraggedId(null);
    window.addEventListener("category-drag-start", onStart);
    window.addEventListener("category-drag-end", onEnd);
    return () => {
      window.removeEventListener("category-drag-start", onStart);
      window.removeEventListener("category-drag-end", onEnd);
    };
  }, []);

  const updateCategorySection = useCallback(async (categoryId: string, section: string | null) => {
    const { error } = await supabase
      .from("categories")
      .update({ dre_section: section })
      .eq("id", categoryId);
    if (error) {
      toast({ title: "Erro ao atualizar centro de custo", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria atualizada!" });
    refetch();
  }, [refetch, toast]);

  // Get root-level categories only for display in cost centers
  const rootCategories = categories.filter(c => !c.parent_id);

  const sectionsToShow = DRE_SECTIONS.filter(s => s.key !== "mdr" || mdrEnabled);
  const unassigned = rootCategories.filter(c => !c.dre_section || !sectionsToShow.some(s => s.key === c.dre_section));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Centros de Custos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Arraste categorias para os centros de custo do DRE — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="mdr-toggle"
            checked={mdrEnabled}
            onCheckedChange={toggleMdr}
          />
          <Label htmlFor="mdr-toggle" className="text-sm cursor-pointer">Taxas MDR</Label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sectionsToShow.map(section => {
            const sectionCats = rootCategories.filter(c => c.dre_section === section.key);
            const isExpanded = expandedSections[section.key] ?? false;

            return (
              <CostCenterFolder
                key={section.key}
                sectionKey={section.key}
                label={section.label}
                sign={section.sign}
                categories={sectionCats}
                expanded={isExpanded}
                onToggle={() => toggleSection(section.key)}
                draggedId={draggedId}
                onDropCategory={(catId) => updateCategorySection(catId, section.key)}
              />
            );
          })}

          {/* Unassigned */}
          <Card className="border-dashed">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Sem centro de custo
                <Badge variant="outline" className="ml-auto text-xs">{unassigned.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div
                className={cn("min-h-[40px] rounded-md transition-colors", draggedId && "ring-1 ring-dashed ring-muted-foreground/30")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) updateCategorySection(id, null);
                }}
              >
                {unassigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Todas as categorias estão atribuídas</p>
                ) : (
                  <div className="space-y-0.5">
                    {unassigned.map(cat => (
                      <DraggableCategoryItem key={cat.id} category={cat} draggedId={draggedId} />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Cost Center Folder ---------- */

interface CostCenterFolderProps {
  sectionKey: string;
  label: string;
  sign: string;
  categories: Category[];
  expanded: boolean;
  onToggle: () => void;
  draggedId: string | null;
  onDropCategory: (categoryId: string) => void;
}

function CostCenterFolder({ sectionKey, label, sign, categories, expanded, onToggle, draggedId, onDropCategory }: CostCenterFolderProps) {
  const [dropHighlight, setDropHighlight] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedId) setDropHighlight(true);
  }, [draggedId]);

  const handleDragLeave = useCallback(() => setDropHighlight(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlight(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) onDropCategory(id);
  }, [onDropCategory]);

  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <Card className={cn("transition-all", dropHighlight && "ring-2 ring-primary/40 bg-primary/5")}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/30 transition-colors rounded-t-lg"
        onClick={onToggle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <FolderIcon className={cn("h-4 w-4 shrink-0", sign === "+" ? "text-emerald-500" : "text-red-500")} />
        <span className="text-sm font-medium flex-1">{label}</span>
        <Badge variant="secondary" className="text-xs">
          {sign === "+" ? "+" : "−"} {categories.length}
        </Badge>
      </div>
      {expanded && (
        <CardContent
          className="pt-0 pb-3 px-4"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={cn("min-h-[32px] rounded-md transition-colors pl-6", dropHighlight && "bg-primary/5")}>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Arraste categorias para cá</p>
            ) : (
              <div className="space-y-0.5">
                {categories.map(cat => (
                  <DraggableCategoryItem key={cat.id} category={cat} draggedId={draggedId} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ---------- Draggable Category Item ---------- */

interface DraggableCategoryItemProps {
  category: Category;
  draggedId: string | null;
}

function DraggableCategoryItem({ category, draggedId }: DraggableCategoryItemProps) {
  const isDragged = draggedId === category.id;
  const typeLabels: Record<string, string> = { receita: "Receita", despesa: "Despesa", ambos: "Ambos" };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", category.id);
    e.dataTransfer.effectAllowed = "move";
    window.dispatchEvent(new CustomEvent("category-drag-start", { detail: { id: category.id } }));
  }, [category.id]);

  const handleDragEnd = useCallback(() => {
    window.dispatchEvent(new CustomEvent("category-drag-end"));
  }, []);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors",
        isDragged && "opacity-30",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <span className="text-sm truncate flex-1">{category.name}</span>
      {category.type && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {typeLabels[category.type] || category.type}
        </Badge>
      )}
    </div>
  );
}

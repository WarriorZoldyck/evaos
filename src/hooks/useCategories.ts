import { mapDatabaseError } from "@/lib/errorMapper";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  type: string | null;
  dre_section: string | null;
  company_id: string | null;
  user_id: string;
  created_at: string | null;
  sort_order: number;
  children?: Category[];
}

export function useCategories() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from("categories").select("*").eq("user_id", effectiveUserId);
    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query.order("sort_order").order("name");
    if (error) {
      toast({ title: "Erro ao carregar categorias", description: mapDatabaseError(error), variant: "destructive" });
    } else {
      setCategories((data as Category[]) || []);
    }
    setLoading(false);
  }, [user, effectiveUserId, isPersonal, selectedCompanyId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (data: { name: string; parent_id?: string | null; type?: string; dre_section?: string | null }) => {
    if (!user) return false;
    // Calculate sort_order: put at end of siblings
    const siblings = categories.filter(c => c.parent_id === (data.parent_id || null));
    const maxSort = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) + 1 : 0;

    // Subcategories always inherit the parent's context (Pessoal/Empresa)
    const parent = data.parent_id ? categories.find(c => c.id === data.parent_id) : null;
    const companyId = parent ? parent.company_id : (selectedCompanyId || null);

    const { error } = await supabase.from("categories").insert({
      name: data.name,
      parent_id: data.parent_id || null,
      type: data.type || "ambos",
      dre_section: data.dre_section || null,
      user_id: effectiveUserId,
      company_id: companyId,
      sort_order: maxSort,
    });
    if (error) {
      toast({ title: "Erro ao criar categoria", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria criada!" });
    fetchCategories();
    return true;
  };


  const updateCategory = async (id: string, data: { name?: string; type?: string; dre_section?: string | null }) => {
    const { error } = await supabase.from("categories").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar categoria", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria atualizada!" });
    fetchCategories();
    return true;
  };

  // Get all descendant IDs of a category (to prevent cycles)
  const getDescendantIds = (catId: string): string[] => {
    const directChildren = categories.filter(c => c.parent_id === catId);
    const ids: string[] = [];
    for (const child of directChildren) {
      ids.push(child.id);
      ids.push(...getDescendantIds(child.id));
    }
    return ids;
  };

  // Calculate depth of a category (0 = root)
  const getDepth = (catId: string): number => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !cat.parent_id) return 0;
    return 1 + getDepth(cat.parent_id);
  };

  // Get max depth of descendants
  const getMaxDescendantDepth = (catId: string): number => {
    const children = categories.filter(c => c.parent_id === catId);
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map(c => getMaxDescendantDepth(c.id)));
  };

  const moveCategory = async (id: string, newParentId: string | null, targetIndex?: number) => {
    // Can't move to self
    if (newParentId === id) {
      toast({ title: "Não é possível mover uma categoria para dentro dela mesma", variant: "destructive" });
      return false;
    }

    // Can't move to own descendant (cycle)
    if (newParentId) {
      const descendants = getDescendantIds(id);
      if (descendants.includes(newParentId)) {
        toast({ title: "Não é possível mover para dentro de um filho", variant: "destructive" });
        return false;
      }
    }

    // Check depth limit: target depth + descendant depth of moved item must be <= 2 (3 levels: 0,1,2)
    if (newParentId) {
      const targetDepth = getDepth(newParentId) + 1; // depth where item would land
      const itemDescDepth = getMaxDescendantDepth(id); // how deep item's tree goes
      if (targetDepth + itemDescDepth > 2) {
        toast({ title: "Limite de 3 níveis atingido", variant: "destructive" });
        return false;
      }
    } else {
      // Moving to root: just check item's own tree depth
      const itemDescDepth = getMaxDescendantDepth(id);
      if (itemDescDepth > 2) {
        toast({ title: "Limite de 3 níveis atingido", variant: "destructive" });
        return false;
      }
    }

    // Get siblings at destination to calculate sort_order
    const siblings = categories
      .filter(c => c.parent_id === newParentId && c.id !== id)
      .sort((a, b) => a.sort_order - b.sort_order);

    let newSortOrder: number;
    if (targetIndex !== undefined && targetIndex < siblings.length) {
      // Insert at specific position
      newSortOrder = targetIndex;
    } else {
      // Append at end
      newSortOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) + 1 : 0;
    }

    // Keep the whole subtree in the parent's context (Pessoal/Empresa)
    const parent = newParentId ? categories.find(c => c.id === newParentId) : null;
    const targetCompanyId = parent ? parent.company_id : (selectedCompanyId || null);
    const moved = categories.find(c => c.id === id);
    const needsContextFix = (moved?.company_id ?? null) !== (targetCompanyId ?? null);

    const { error } = await supabase
      .from("categories")
      .update({ parent_id: newParentId, sort_order: newSortOrder, company_id: targetCompanyId })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao mover categoria", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }

    if (needsContextFix) {
      const descendants = getDescendantIds(id);
      if (descendants.length > 0) {
        await supabase
          .from("categories")
          .update({ company_id: targetCompanyId })
          .in("id", descendants);
      }
    }


    // Reindex siblings for clean ordering
    const updatedSiblings = [
      ...siblings.slice(0, targetIndex ?? siblings.length),
      { id, sort_order: newSortOrder },
      ...siblings.slice(targetIndex ?? siblings.length),
    ];
    
    const reindexPromises = updatedSiblings.map((s, i) =>
      supabase.from("categories").update({ sort_order: i }).eq("id", s.id)
    );
    await Promise.all(reindexPromises);

    toast({ title: "Categoria movida!" });
    fetchCategories();
    return true;
  };

  const deleteCategory = async (id: string) => {
    const children = categories.filter((c) => c.parent_id === id);
    if (children.length > 0) {
      toast({ title: "Erro", description: "Exclua as subcategorias primeiro.", variant: "destructive" });
      return false;
    }
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir categoria", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria excluída!" });
    fetchCategories();
    return true;
  };

  // Build tree structure respecting sort_order
  const buildTree = (items: Category[], parentId: string | null = null): Category[] => {
    return items
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((c) => ({ ...c, children: buildTree(items, c.id) }));
  };

  const tree = search ? buildFilteredTree(categories, search) : buildTree(categories);

  // Categories whose parent is not visible in the current context — shown as "Sem grupo"
  const loadedIds = new Set(categories.map((c) => c.id));
  const orphans = categories
    .filter((c) => c.parent_id && !loadedIds.has(c.parent_id))
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ ...c, children: buildTree(categories, c.id) }));

  return {
    categories,
    tree,
    orphans,
    loading,
    search,
    setSearch,
    createCategory,
    updateCategory,
    moveCategory,
    deleteCategory,
    refetch: fetchCategories,
  };

}

function buildFilteredTree(items: Category[], search: string): Category[] {
  const lower = search.toLowerCase();
  const matchingIds = new Set<string>();

  items.forEach((c) => {
    if (c.name.toLowerCase().includes(lower)) {
      matchingIds.add(c.id);
      let current = c;
      while (current.parent_id) {
        matchingIds.add(current.parent_id);
        const parent = items.find((p) => p.id === current.parent_id);
        if (!parent) break;
        current = parent;
      }
    }
  });

  const filteredItems = items.filter((c) => matchingIds.has(c.id));

  const buildTree = (parentId: string | null): Category[] => {
    return filteredItems
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((c) => ({ ...c, children: buildTree(c.id) }));
  };

  return buildTree(null);
}

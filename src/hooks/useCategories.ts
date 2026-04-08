import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  children?: Category[];
}

export function useCategories() {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from("categories").select("*");
    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query.order("name");
    if (error) {
      toast({ title: "Erro ao carregar categorias", description: error.message, variant: "destructive" });
    } else {
      setCategories((data as Category[]) || []);
    }
    setLoading(false);
  }, [user, isPersonal, selectedCompanyId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (data: { name: string; parent_id?: string | null; type?: string; dre_section?: string | null }) => {
    if (!user) return false;
    const { error } = await supabase.from("categories").insert({
      name: data.name,
      parent_id: data.parent_id || null,
      type: data.type || "ambos",
      dre_section: data.dre_section || null,
      user_id: user.id,
      company_id: selectedCompanyId || null,
    });
    if (error) {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria criada!" });
    fetchCategories();
    return true;
  };

  const updateCategory = async (id: string, data: { name?: string; type?: string; dre_section?: string | null }) => {
    const { error } = await supabase.from("categories").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria atualizada!" });
    fetchCategories();
    return true;
  };

  const moveCategory = async (id: string, newParentId: string | null) => {
    // Validate max 3 levels
    if (newParentId) {
      let depth = 1;
      let current = categories.find((c) => c.id === newParentId);
      while (current?.parent_id) {
        depth++;
        current = categories.find((c) => c.id === current!.parent_id);
      }
      // The item being moved would be at depth+1
      if (depth >= 3) {
        toast({ title: "Limite de 3 níveis atingido", variant: "destructive" });
        return false;
      }
    }

    const { error } = await supabase.from("categories").update({ parent_id: newParentId }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao mover categoria", description: error.message, variant: "destructive" });
      return false;
    }
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
      toast({ title: "Erro ao excluir categoria", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria excluída!" });
    fetchCategories();
    return true;
  };

  // Build tree structure
  const buildTree = (items: Category[], parentId: string | null = null): Category[] => {
    return items
      .filter((c) => c.parent_id === parentId)
      .map((c) => ({ ...c, children: buildTree(items, c.id) }));
  };

  const tree = search ? buildFilteredTree(categories, search) : buildTree(categories);

  return {
    categories,
    tree,
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
      .map((c) => ({ ...c, children: buildTree(c.id) }));
  };

  return buildTree(null);
}

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
      setCategories(data || []);
    }
    setLoading(false);
  }, [user, isPersonal, selectedCompanyId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (data: { name: string; parent_id?: string | null; type?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from("categories").insert({
      name: data.name,
      parent_id: data.parent_id || null,
      type: data.type || "ambos",
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

  const updateCategory = async (id: string, data: { name?: string; type?: string }) => {
    const { error } = await supabase.from("categories").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Categoria atualizada!" });
    fetchCategories();
    return true;
  };

  const deleteCategory = async (id: string) => {
    // Check for children
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
      .filter((c) =>
        search
          ? c.name.toLowerCase().includes(search.toLowerCase())
            || items.some((child) => child.parent_id === c.id && child.name.toLowerCase().includes(search.toLowerCase()))
            || (c.parent_id && items.find((p) => p.id === c.parent_id)?.name.toLowerCase().includes(search.toLowerCase()))
          : true
      )
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
    deleteCategory,
    refetch: fetchCategories,
  };
}

function buildFilteredTree(items: Category[], search: string): Category[] {
  const lower = search.toLowerCase();
  const matchingIds = new Set<string>();

  // Find all matching items and their ancestors
  items.forEach((c) => {
    if (c.name.toLowerCase().includes(lower)) {
      matchingIds.add(c.id);
      // Add ancestors
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

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CostGroup } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CategoryAverage {
  categoryName: string;
  categoryId: string;
  monthlyAverage: number;
  totalLast12: number;
  transactionCount: number;
}

interface ImportCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CostGroup;
  groupLabel: string;
  existingDescriptions: string[];
  onImport: (items: { description: string; value: number }[]) => Promise<void>;
}

export function ImportCategoriesModal({
  open, onOpenChange, group, groupLabel, existingDescriptions, onImport,
}: ImportCategoriesModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<CategoryAverage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    loadCategoryAverages();
  }, [open, user]);

  const loadCategoryAverages = async () => {
    if (!user) return;
    setLoading(true);
    setSelected(new Set());

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Fetch all user categories and transactions in parallel
    const [catResult, txResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, parent_id, type")
        .eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("amount, category")
        .eq("user_id", user.id)
        .eq("type", "despesa")
        .eq("status", "Pago")
        .gte("payment_date", twelveMonthsAgo.toISOString().split("T")[0]),
    ]);

    const cats = catResult.data || [];
    const txs = txResult.data || [];

    // Build category name lookup (handle hierarchical names)
    const catMap = new Map(cats.map(c => [c.id, c]));
    
    const getFullName = (cat: typeof cats[0]): string => {
      if (cat.parent_id) {
        const parent = catMap.get(cat.parent_id);
        if (parent) return `${getFullName(parent)} > ${cat.name}`;
      }
      return cat.name;
    };

    // Group transactions by category name and calculate averages
    const totals = new Map<string, { total: number; count: number }>();
    txs.forEach(tx => {
      const catName = tx.category || "Sem Categoria";
      const existing = totals.get(catName) || { total: 0, count: 0 };
      existing.total += Number(tx.amount) || 0;
      existing.count++;
      totals.set(catName, existing);
    });

    // Also match by category UUID (category field might store name or id)
    // Build results: merge category names from both sources
    const results: CategoryAverage[] = [];
    const addedNames = new Set<string>();

    // From categories table - find matching transactions
    cats.forEach(cat => {
      const fullName = getFullName(cat);
      const byName = totals.get(cat.name);
      const byFullName = totals.get(fullName);
      const byId = totals.get(cat.id);
      
      const match = byName || byFullName || byId;
      if (match && match.total > 0) {
        results.push({
          categoryName: cat.name,
          categoryId: cat.id,
          monthlyAverage: match.total / 12,
          totalLast12: match.total,
          transactionCount: match.count,
        });
        addedNames.add(cat.name);
        if (byFullName) addedNames.add(fullName);
      }
    });

    // From transactions that don't match any category record (free-text categories)
    totals.forEach((val, catName) => {
      if (!addedNames.has(catName) && val.total > 0) {
        results.push({
          categoryName: catName,
          categoryId: catName,
          monthlyAverage: val.total / 12,
          totalLast12: val.total,
          transactionCount: val.count,
        });
      }
    });

    // Sort by monthly average descending
    results.sort((a, b) => b.monthlyAverage - a.monthlyAverage);
    setCategories(results);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c => c.categoryName.toLowerCase().includes(q));
  }, [categories, search]);

  const alreadyImported = (name: string) =>
    existingDescriptions.some(d => d.toLowerCase() === name.toLowerCase());

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(
        filtered.filter(c => !alreadyImported(c.categoryName)).map(c => c.categoryId)
      ));
    } else {
      setSelected(new Set());
    }
  };

  const handleImport = async () => {
    const items = categories
      .filter(c => selected.has(c.categoryId))
      .map(c => ({
        description: c.categoryName,
        value: Math.round(c.monthlyAverage * 100) / 100,
      }));

    if (items.length === 0) return;
    setImporting(true);
    await onImport(items);
    setImporting(false);
    onOpenChange(false);
  };

  const totalSelected = categories
    .filter(c => selected.has(c.categoryId))
    .reduce((s, c) => s + c.monthlyAverage, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Categorias — {groupLabel}
          </DialogTitle>
          <DialogDescription>
            Selecione as categorias de despesa do seu sistema. Os valores são a média mensal dos últimos 12 meses de lançamentos pagos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === filtered.filter(c => !alreadyImported(c.categoryName)).length}
                        onCheckedChange={c => toggleAll(!!c)}
                      />
                    </th>
                    <th className="p-2 text-left font-medium">Categoria</th>
                    <th className="p-2 text-right font-medium">Média Mensal</th>
                    <th className="p-2 text-right font-medium">Total 12m</th>
                    <th className="p-2 text-center font-medium">Lançam.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Nenhuma categoria com despesas encontrada nos últimos 12 meses.
                      </td>
                    </tr>
                  )}
                  {filtered.map(c => {
                    const imported = alreadyImported(c.categoryName);
                    return (
                      <tr key={c.categoryId} className={`border-b border-border/50 ${imported ? "opacity-40" : ""}`}>
                        <td className="p-2">
                          <Checkbox
                            checked={selected.has(c.categoryId)}
                            onCheckedChange={() => toggleSelect(c.categoryId)}
                            disabled={imported}
                          />
                        </td>
                        <td className="p-2">
                          {c.categoryName}
                          {imported && (
                            <Badge variant="outline" className="ml-2 text-[9px]">Já importado</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">{fmt(c.monthlyAverage)}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{fmt(c.totalLast12)}</td>
                        <td className="p-2 text-center text-muted-foreground">{c.transactionCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selected.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selected.size} categorias selecionadas — Total mensal: <span className="font-bold text-foreground">{fmt(totalSelected)}</span>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing || selected.size === 0} className="gap-1">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Importar {selected.size > 0 ? `${selected.size} categorias` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

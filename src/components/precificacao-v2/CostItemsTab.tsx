import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download } from "lucide-react";
import type { CostItem, CostGroup } from "@/hooks/usePricingV2";
import { ImportCategoriesModal } from "./ImportCategoriesModal";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GROUP_LABELS: Record<CostGroup, string> = {
  fixos_clinica: "Fixos Clínica",
  variaveis_clinica: "Variáveis Clínica",
  pessoais: "Pessoais (Casa)",
};

const CATEGORIES: Record<CostGroup, string[]> = {
  fixos_clinica: ["Prediais", "Salários", "Administrativos", "Outros", "Importado"],
  variaveis_clinica: ["Dentais", "Salário (parceiros)", "Laboratório", "Honorários", "Implantes", "Administrativo", "Diversos", "Importado"],
  pessoais: ["Educação", "Moradia", "Salários", "Lazer", "Planejamento", "Vestuário", "Supérfluos", "Alimentação", "Transporte", "Saúde", "Outros", "Importado"],
};

interface CostItemsTabProps {
  group: CostGroup;
  items: CostItem[];
  onAdd: (item: { cost_group: string; category: string; description: string; value: number; frequency: string }) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<Pick<CostItem, "category" | "description" | "value" | "frequency">>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function CostItemsTab({ group, items, onAdd, onUpdate, onDelete }: CostItemsTabProps) {
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState(CATEGORIES[group][0] || "");
  const [newDesc, setNewDesc] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newFreq, setNewFreq] = useState("M");
  const [importOpen, setImportOpen] = useState(false);

  const groupItems = items.filter((i) => i.cost_group === group);
  const categories = CATEGORIES[group];

  const byCategory = categories.reduce<Record<string, CostItem[]>>((acc, cat) => {
    acc[cat] = groupItems.filter((i) => i.category === cat);
    return acc;
  }, {});

  const monthlyVal = (item: CostItem) => (item.frequency === "A" ? item.value / 12 : item.value);
  const annualVal = (item: CostItem) => (item.frequency === "A" ? item.value : item.value * 12);
  const totalMonthly = groupItems.reduce((s, i) => s + monthlyVal(i), 0);
  const totalAnnual = groupItems.reduce((s, i) => s + annualVal(i), 0);

  const handleAdd = async () => {
    if (!newDesc.trim() || !newVal) return;
    setAdding(true);
    await onAdd({
      cost_group: group,
      category: newCat,
      description: newDesc.trim(),
      value: parseFloat(newVal) || 0,
      frequency: newFreq,
    });
    setNewDesc("");
    setNewVal("");
    setAdding(false);
  };

  const handleImportCategories = async (importedItems: { description: string; value: number }[]) => {
    for (const item of importedItems) {
      await onAdd({
        cost_group: group,
        category: "Importado",
        description: item.description,
        value: item.value,
        frequency: "M",
      });
    }
  };

  // Category breakdown percentages
  const categoryBreakdown = categories
    .map((cat) => {
      const catItems = byCategory[cat] || [];
      const catAnnual = catItems.reduce((s, i) => s + annualVal(i), 0);
      const pct = totalAnnual > 0 ? (catAnnual / totalAnnual) * 100 : 0;
      return { cat, total: catAnnual, pct };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Category breakdown bar */}
      {categoryBreakdown.length > 1 && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Distribuição por categoria (anual: {fmt(totalAnnual)})</p>
          <div className="space-y-1.5">
            {categoryBreakdown.map((c) => (
              <div key={c.cat} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-muted-foreground">{c.cat}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all"
                    style={{ width: `${Math.max(c.pct, 1)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-medium">{c.pct.toFixed(1)}%</span>
                <span className="w-24 text-right text-muted-foreground">{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Categoria</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[120px] text-right">Valor (R$)</TableHead>
            <TableHead className="w-[80px] text-center">Freq.</TableHead>
            <TableHead className="w-[120px] text-right">Mensal</TableHead>
            <TableHead className="w-[120px] text-right">Total Ano</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => {
            const catItems = byCategory[cat] || [];
            if (catItems.length === 0) return null;
            const catTotal = catItems.reduce((s, i) => s + monthlyVal(i), 0);
            const catAnnual = catItems.reduce((s, i) => s + annualVal(i), 0);
            return catItems.map((item, idx) => (
              <TableRow key={item.id}>
                {idx === 0 && (
                  <TableCell rowSpan={catItems.length} className="align-top font-medium text-xs text-muted-foreground border-r">
                    {cat}
                    <div className="mt-1 text-xs font-bold text-foreground">{fmt(catTotal)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmt(catAnnual)}/ano</div>
                  </TableCell>
                )}
                <TableCell>
                  <Input
                    defaultValue={item.description}
                    onBlur={(e) => {
                      if (e.target.value !== item.description) onUpdate(item.id, { description: e.target.value });
                    }}
                    className="h-8 text-sm border-0 bg-transparent p-0 focus-visible:ring-1"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    defaultValue={String(item.value)}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      if (v !== item.value) onUpdate(item.id, { value: v });
                    }}
                    className="h-8 text-sm text-right border-0 bg-transparent p-0 focus-visible:ring-1 w-full"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Select
                    defaultValue={item.frequency}
                    onValueChange={(v) => onUpdate(item.id, { frequency: v })}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs mx-auto border-0 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{fmt(monthlyVal(item))}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{fmt(annualVal(item))}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ));
          })}
          {groupItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhum item cadastrado. Adicione abaixo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {groupItems.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
              <TableCell className="text-right font-bold text-primary">{fmt(totalMonthly)}</TableCell>
              <TableCell className="text-right font-bold text-muted-foreground">{fmt(totalAnnual)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>

      {/* Add new item row */}
      <div className="flex items-end gap-2 p-3 rounded-lg border border-dashed">
        <div className="space-y-1 w-[140px]">
          <span className="text-xs text-muted-foreground">Categoria</span>
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Descrição</span>
          <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Ex: Aluguel" className="h-8 text-sm" />
        </div>
        <div className="w-[100px] space-y-1">
          <span className="text-xs text-muted-foreground">Valor (R$)</span>
          <Input type="number" value={newVal} onChange={(e) => setNewVal(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="w-[70px] space-y-1">
          <span className="text-xs text-muted-foreground">Freq.</span>
          <Select value={newFreq} onValueChange={setNewFreq}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="A">A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={adding || !newDesc.trim()} size="sm" className="gap-1 h-8">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
        <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setImportOpen(true)}>
          <Download className="h-3.5 w-3.5" /> Importar do Sistema
        </Button>
      </div>

      <ImportCategoriesModal
        open={importOpen}
        onOpenChange={setImportOpen}
        group={group}
        groupLabel={GROUP_LABELS[group]}
        existingDescriptions={groupItems.map(i => i.description)}
        onImport={handleImportCategories}
      />
    </div>
  );
}

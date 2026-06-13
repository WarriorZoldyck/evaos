import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SECTION_LABEL } from "@/lib/dreSections";
import type { Category } from "@/hooks/useCategories";

interface Props {
  categories: Category[];
  onChanged: () => void;
}

interface DuplicateGroup {
  name: string;
  mapped: Category[];
  unmapped: Category[];
  resolvedSection: string;
}

// Walk up a category chain to find the root-most dre_section.
function resolveSection(cat: Category, byId: Map<string, Category>): string | null {
  let current: Category | undefined = cat;
  let last: string | null = null;
  while (current) {
    if (current.dre_section) last = current.dre_section;
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return last;
}

export function CategoryDiagnosticsPanel({ categories, onChanged }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { duplicates, unmappedRootCount } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const roots = categories.filter((c) => !c.parent_id);

    // Group roots by lowercased name
    const groups = new Map<string, Category[]>();
    roots.forEach((r) => {
      const key = r.name.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    const dups: DuplicateGroup[] = [];
    groups.forEach((group, key) => {
      if (group.length < 2) return;
      const withSection = group.filter((c) => !!resolveSection(c, byId));
      const without = group.filter((c) => !resolveSection(c, byId));
      if (withSection.length === 0 || without.length === 0) return;
      // Use most common section among mapped ones
      const counts = new Map<string, number>();
      withSection.forEach((c) => {
        const s = resolveSection(c, byId)!;
        counts.set(s, (counts.get(s) || 0) + 1);
      });
      const resolved = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      dups.push({
        name: group[0].name,
        mapped: withSection,
        unmapped: without,
        resolvedSection: resolved,
      });
    });

    const unmappedRoots = roots.filter((r) => !resolveSection(r, byId));

    return { duplicates: dups, unmappedRootCount: unmappedRoots.length };
  }, [categories]);

  const applyMapping = async (group: DuplicateGroup) => {
    setBusy(group.name);
    try {
      const ids = group.unmapped.map((c) => c.id);
      const { error } = await supabase
        .from("categories")
        .update({ dre_section: group.resolvedSection })
        .in("id", ids);
      if (error) throw error;
      toast({
        title: "Mapeamento aplicado",
        description: `${ids.length} categoria(s) "${group.name}" agora apontam para ${SECTION_LABEL[group.resolvedSection] || group.resolvedSection}.`,
      });
      onChanged();
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const hasIssues = duplicates.length > 0 || unmappedRootCount > 0;

  if (!hasIssues) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-4 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-200">
            Diagnóstico: todas as categorias raiz estão mapeadas no DRE.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Diagnóstico de mapeamento DRE
            <Badge variant="outline" className="ml-2">
              {duplicates.length} duplicata(s) · {unmappedRootCount} raiz(es) sem seção
            </Badge>
          </CardTitle>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {duplicates.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Categorias duplicadas com mapeamento divergente
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Existem categorias com o mesmo nome — algumas mapeadas, outras não. Transações
                ligadas às não mapeadas caem em "Não Classificadas".
              </p>
              <ul className="space-y-2">
                {duplicates.map((g) => (
                  <li
                    key={g.name}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-background/60 border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.mapped.length} mapeada(s) em{" "}
                        <span className="text-foreground">
                          {SECTION_LABEL[g.resolvedSection] || g.resolvedSection}
                        </span>
                        {" · "}
                        {g.unmapped.length} sem mapeamento
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === g.name}
                      onClick={() => applyMapping(g)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Aplicar mesmo
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unmappedRootCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Há <span className="text-foreground font-medium">{unmappedRootCount}</span> categoria(s)
              raiz sem nenhum mapeamento no DRE. Role até a área "Não classificadas" abaixo e arraste
              cada uma para o centro de custo correto.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

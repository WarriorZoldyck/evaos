import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TopCategory } from "@/hooks/useMetasSidebarStats";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ActionPlanDialogProps {
  open: boolean;
  onClose: () => void;
  gap: number; // valor faltando (positivo = déficit)
  topCategories: TopCategory[];
  goalName?: string;
  title?: string;
}

export function ActionPlanDialog({
  open, onClose, gap, topCategories, goalName, title,
}: ActionPlanDialogProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);

  const totalTop = topCategories.reduce((s, c) => s + c.total, 0);

  const askEva = async () => {
    setAiLoading(true);
    setAiText(null);
    try {
      const { data, error } = await supabase.functions.invoke("goal-action-plan", {
        body: {
          gap_reais: gap,
          top_categories: topCategories.map((c) => ({ name: c.name, total: c.total })),
          goal_name: goalName || null,
        },
      });
      if (error) throw error;
      setAiText(data?.plan || "Sem sugestões no momento.");
    } catch (e: any) {
      const msg = e?.message || "Erro ao consultar a EVA.";
      if (msg.includes("402")) toast.error("Créditos de IA esgotados. Adicione mais em Configurações.");
      else if (msg.includes("429")) toast.error("Muitas requisições. Tente novamente em instantes.");
      else toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            {title || "Não vai sobrar — plano de ação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Déficit estimado</p>
            <p className="text-2xl font-bold font-mono text-destructive mt-1">{fmt(gap)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Precisa cortar/gerar esse valor até o fim do ano.
            </p>
          </div>

          {topCategories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                De onde tirar? Suas 3 maiores despesas do ano:
              </p>
              {topCategories.map((c) => {
                const share = totalTop > 0 ? (c.total / totalTop) * 100 : 0;
                const suggestedCut = Math.min(c.total, (gap * c.total) / Math.max(totalTop, 1));
                return (
                  <div key={c.name} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-mono text-muted-foreground">{fmt(c.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cortar ~<strong className="text-foreground">{fmt(suggestedCut)}</strong> ({share.toFixed(0)}% do gasto) já ajuda a fechar o buraco.
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {aiText && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Plano sugerido pela EVA
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown>{aiText}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={askEva} disabled={aiLoading} className="gap-2">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiText ? "Pedir de novo" : "Pedir sugestão à EVA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

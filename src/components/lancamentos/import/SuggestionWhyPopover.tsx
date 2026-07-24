import { BookOpen, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { SuggestionSource, SuggestionLayer } from "@/hooks/useCategorySuggestions";

const LAYER_LABEL: Record<SuggestionLayer, string> = {
  exact: "descrição idêntica",
  prefix: "descrição parecida",
  merchant: "mesmo comerciante",
  token: "palavras em comum",
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

const fmtMoney = (v: number | null) => {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

interface Props {
  suggestion: SuggestionSource;
  rowDescription: string;
}

export function SuggestionWhyPopover({ suggestion, rowDescription }: Props) {
  const samples = suggestion.matchedSamples ?? [];
  const layer = suggestion.layer;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 underline decoration-dotted underline-offset-2"
          title="Ver evidência do histórico"
        >
          <BookOpen className="h-2.5 w-2.5" /> baseado no histórico
          <Info className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] text-xs p-3 space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Linha do extrato
          </div>
          <div className="font-medium break-words">{rowDescription}</div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {layer && (
            <Badge variant="secondary" className="text-[9px]">
              {LAYER_LABEL[layer]}
            </Badge>
          )}
          {typeof suggestion.voteCount === "number" && typeof suggestion.candidateCount === "number" && (
            <Badge variant="outline" className="text-[9px]">
              {suggestion.voteCount}/{suggestion.candidateCount} amostras concordaram
            </Badge>
          )}
          <Badge variant="outline" className="text-[9px]">100% do seu histórico</Badge>
        </div>

        {suggestion.normalizedQuery && (
          <div className="text-[10px] text-muted-foreground">
            chave da busca: <code className="bg-muted px-1 rounded">{suggestion.normalizedQuery}</code>
          </div>
        )}

        <div className="border-t pt-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Lançamentos seus que embasaram
          </div>
          {samples.length === 0 ? (
            <div className="text-muted-foreground italic">Sem amostras disponíveis.</div>
          ) : (
            <ul className="space-y-1.5">
              {samples.map((s, i) => (
                <li key={i} className="border rounded p-1.5 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium break-words">{s.description || "—"}</span>
                    <span className="font-mono text-[10px] whitespace-nowrap">{fmtMoney(s.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{fmtDate(s.payment_date)}</span>
                    <span className="text-[10px] text-primary">{s.categoryPath}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

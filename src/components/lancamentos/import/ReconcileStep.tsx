import { useMemo, useState } from "react";
import { Check, Link2, Search, X, ArrowLeftRight, Sparkles, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManualMatchModal } from "@/components/conciliacao/ManualMatchModal";
import type { RowMatch } from "@/hooks/useImportMatching";
import type { SuggestionSource } from "@/hooks/useCategorySuggestions";

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  selected: boolean;
}

interface ReconcileStepProps {
  rows: ParsedRow[];
  matches: Record<number, RowMatch>;
  matchLoading: boolean;
  matchActions: Record<number, "vincular" | "criar" | "ignorar">;
  matchTargets: Record<number, string>;
  onActionChange: (idx: number, action: "vincular" | "criar" | "ignorar") => void;
  onTargetChange: (idx: number, txId: string) => void;
  bankAccountId: string | null;
  walletId: string | null;
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
  rowCategories: Record<number, string>;
  suggestions: Record<number, SuggestionSource>;
  suggestLoading: boolean;
  onCategoryChange: (idx: number, name: string) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export function ReconcileStep({
  rows,
  matches,
  matchLoading,
  matchActions,
  matchTargets,
  onActionChange,
  onTargetChange,
  bankAccountId,
  walletId,
  categories,
  rowCategories,
  suggestions,
  suggestLoading,
  onCategoryChange,
}: ReconcileStepProps) {
  const [manualForRow, setManualForRow] = useState<number | null>(null);

  // Build indexed list of selected rows
  const indexed = useMemo(
    () =>
      rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.selected),
    [rows]
  );

  const matchedRows = indexed.filter(
    ({ i }) => (matchActions[i] || "criar") === "vincular" && matches[i]?.best
  );
  const newRows = indexed.filter(({ i }) => {
    const a = matchActions[i] || "criar";
    return a === "criar" || (a === "vincular" && !matches[i]?.best);
  });
  const ignoredRows = indexed.filter(({ i }) => matchActions[i] === "ignorar");

  const conciliateAll = () => {
    indexed.forEach(({ i }) => {
      if (matches[i]?.best) {
        onActionChange(i, "vincular");
        onTargetChange(i, matches[i]!.best!.candidate.id);
      }
    });
  };

  const createAll = () => {
    indexed.forEach(({ i }) => {
      onActionChange(i, "criar");
    });
  };

  const handleManualPick = async (rowIdx: number, txId: string) => {
    onTargetChange(rowIdx, txId);
    onActionChange(rowIdx, "vincular");
    setManualForRow(null);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* Header summary */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Conciliação assistida
          {matchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          O EVA comparou o extrato com os lançamentos pendentes na conta.
          Confirme as correspondências e escolha o que criar do zero.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={conciliateAll} className="h-7 text-xs gap-1">
            <Check className="h-3 w-3" /> Conciliar todos os pares
          </Button>
          <Button size="sm" variant="ghost" onClick={createAll} className="h-7 text-xs">
            Criar tudo do zero
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-1">
        {/* SECTION A — Matches */}
        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Correspondências encontradas
              <Badge variant="secondary" className="text-[10px]">{matchedRows.length}</Badge>
            </h3>
          </header>
          {matchedRows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-3 border rounded-lg bg-muted/20">
              Nenhuma correspondência automática.
              {indexed.some(({ i }) => matches[i]?.best) && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-2 text-xs"
                  onClick={conciliateAll}
                >
                  Aceitar sugestões
                </Button>
              )}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              {matchedRows.map(({ r, i }) => {
                const m = matches[i]!;
                const best = m.best!;
                const cand = best.candidate;
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center p-3 hover:bg-accent/30">
                    {/* Extrato */}
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Extrato</p>
                      <p className="font-medium text-sm truncate" title={r.description}>{r.description}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span></p>
                    </div>
                    <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
                    {/* EVA */}
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">EVA — Pendente</p>
                      <p className="font-medium text-sm truncate" title={cand.description}>{cand.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(cand.payment_date)} · <span className="font-mono">{fmt(Number(cand.amount))}</span>
                        {cand.contact_name ? ` · ${cand.contact_name}` : ""}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" title="Trocar correspondência">
                            <ArrowLeftRight className="h-3 w-3" /> Trocar
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 p-2">
                          <p className="text-xs font-medium mb-2">Outros candidatos</p>
                          {m.alternatives.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Sem outras sugestões automáticas.</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-auto">
                              {m.alternatives.map((alt) => (
                                <button
                                  key={alt.id}
                                  type="button"
                                  onClick={() => onTargetChange(i, alt.id)}
                                  className={`w-full text-left p-2 rounded text-xs hover:bg-accent ${
                                    matchTargets[i] === alt.id ? "bg-primary/10" : ""
                                  }`}
                                >
                                  <p className="font-medium truncate">{alt.description}</p>
                                  <p className="text-muted-foreground">
                                    {fmtDate(alt.payment_date)} · <span className="font-mono">{fmt(Number(alt.amount))}</span>
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 h-7 text-xs gap-1"
                            onClick={() => setManualForRow(i)}
                          >
                            <Search className="h-3 w-3" /> Buscar manualmente
                          </Button>
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onActionChange(i, "criar")}
                        title="Desfazer e criar como novo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Criar no sistema
              <Badge variant="secondary" className="text-[10px]">{newRows.length}</Badge>
              {suggestLoading && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" /> sugerindo categorias...
                </span>
              )}
            </h3>
          </header>
          {newRows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-3 border rounded-lg bg-muted/20">
              Nenhum lançamento novo a criar.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b text-xs">
                    <th className="p-2 text-left font-medium">Data</th>
                    <th className="p-2 text-left font-medium">Descrição</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                    <th className="p-2 text-left font-medium w-[200px]">Categoria sugerida</th>
                    <th className="p-2 text-center font-medium w-16">Ignorar</th>
                  </tr>
                </thead>
                <tbody>
                  {newRows.map(({ r, i }) => {
                    const sug = suggestions[i];
                    const currentCat = rowCategories[i] || "";
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="p-2 text-muted-foreground whitespace-nowrap text-xs">{fmtDate(r.date)}</td>
                        <td className="p-2 max-w-[260px]">
                          <p className="truncate" title={r.description}>{r.description}</p>
                          <Badge variant={r.type === "receita" ? "default" : "destructive"} className="text-[9px] mt-0.5">
                            {r.type === "receita" ? "Entrada" : "Saída"}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono whitespace-nowrap">{fmt(r.amount)}</td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1">
                            <Select
                              value={currentCat || "__none__"}
                              onValueChange={(v) =>
                                onCategoryChange(i, v === "__none__" ? "" : v)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Sem categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sem categoria</SelectItem>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.name}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {sug && currentCat === sug.category && (
                              <span
                                className="text-[10px] text-muted-foreground flex items-center gap-1"
                                title={sug.source === "history" ? "Baseado em lançamentos anteriores seus" : "Sugerido pela IA"}
                              >
                                {sug.source === "history" ? (
                                  <><BookOpen className="h-2.5 w-2.5" /> baseado no histórico</>
                                ) : (
                                  <><Sparkles className="h-2.5 w-2.5 text-amber-500" /> sugerido pela IA</>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => onActionChange(i, "ignorar")}
                            title="Marcar para ignorar"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>


        {/* SECTION C — Ignored */}
        {ignoredRows.length > 0 && (
          <section>
            <header className="mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <X className="h-4 w-4" />
                Ignorados
                <Badge variant="secondary" className="text-[10px]">{ignoredRows.length}</Badge>
              </h3>
            </header>
            <div className="border rounded-lg divide-y opacity-60">
              {ignoredRows.map(({ r, i }) => (
                <div key={i} className="flex justify-between items-center p-2 text-xs">
                  <span className="truncate">{fmtDate(r.date)} · {r.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{fmt(r.amount)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => onActionChange(i, "criar")}
                    >
                      Restaurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {manualForRow !== null && (bankAccountId || walletId) && (
        <ManualMatchModal
          item={{
            id: String(manualForRow),
            amount: rows[manualForRow].amount,
            date: rows[manualForRow].date,
            description: rows[manualForRow].description,
          }}
          bankAccountId={(bankAccountId || walletId)!}
          onClose={() => setManualForRow(null)}
          onConfirm={(txId) => handleManualPick(manualForRow, txId)}
        />
      )}
    </div>
  );
}

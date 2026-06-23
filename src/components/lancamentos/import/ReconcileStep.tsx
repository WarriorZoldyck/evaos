import { useMemo, useState } from "react";
import {
  Check,
  Link2,
  Search,
  X,
  ArrowLeftRight,
  Sparkles,
  Loader2,
  BookOpen,
  Info,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export interface RowCategoryValue {
  category: string;
  subcategory?: string;
  subcategory2?: string;
  touched?: boolean;
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
  rowCategories: Record<number, RowCategoryValue>;
  suggestions: Record<number, SuggestionSource>;
  suggestLoading: boolean;
  onCategoryChange: (idx: number, value: RowCategoryValue) => void;
  /** "debit" shows conciliation against pending entries. "card" only shows categorization. */
  mode?: "debit" | "card";
  /** Transactions already in the system that DID NOT match any line of the statement. */
  orphans?: { id: string; description: string; amount: number; competence_date: string; payment_date: string; status: string }[];
  orphansLoading?: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const normalizeText = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
  mode = "debit",
  orphans = [],
  orphansLoading = false,
}: ReconcileStepProps) {
  const isCardMode = mode === "card";
  const [manualForRow, setManualForRow] = useState<number | null>(null);
  const [showOrphans, setShowOrphans] = useState(false);

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

  // Count of identical rows (same desc+amount+type) for the "×N" badge in "Criar no sistema".
  const duplicateCounts = useMemo(() => {
    const map = new Map<string, number>();
    newRows.forEach(({ r }) => {
      const key = `${r.type}|${Math.abs(r.amount)}|${normalizeText(r.description)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [newRows]);

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

  // Hierarchical category helpers
  const rootCats = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (parentName: string | undefined) => {
    if (!parentName) return [];
    const parent = categories.find((c) => c.name === parentName);
    if (!parent) return [];
    return categories.filter((c) => c.parent_id === parent.id);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Header summary */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            {isCardMode ? "Conciliação & categorização" : "Conciliação assistida"}
            {(matchLoading || suggestLoading) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cada linha do extrato vira uma ação no seu sistema:{" "}
            <strong>casar com lançamento existente</strong>, <strong>importar como novo</strong>{" "}
            ou <strong>já existe — não importar</strong>. Revise antes de confirmar.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={conciliateAll} className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Casar automaticamente os pares sugeridos
            </Button>
            <Button size="sm" variant="ghost" onClick={createAll} className="h-7 text-xs">
              Importar tudo como novo
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          {/* ORPHANS — system has more than the statement (likely errors/duplicates) */}
          {isCardMode && !orphansLoading && orphans.length > 0 && (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-xs leading-relaxed ml-1">
                <div className="font-semibold text-destructive mb-1">
                  Encontramos {orphans.length} lançamento{orphans.length > 1 ? "s" : ""} no sistema que NÃO está{orphans.length > 1 ? "ão" : ""} no extrato do cartão
                  {" — "}
                  <span className="font-mono">
                    {orphans.reduce((s, o) => s + Math.abs(o.amount), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  O extrato do banco é a verdade. Lançamentos extras no sistema costumam ser <strong>erros</strong> (digitação duplicada, importação anterior corrompida, ghost de recuperação) ou pertencem a outra fatura. Recomendamos revisar e excluir os incorretos para a sua fatura bater certinho.
                </p>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 mt-1 text-xs text-destructive"
                  onClick={() => setShowOrphans((v) => !v)}
                >
                  {showOrphans ? "Ocultar lista" : `Ver ${orphans.length} suspeito${orphans.length > 1 ? "s" : ""}`}
                </Button>
                {showOrphans && (
                  <div className="mt-2 border rounded bg-background max-h-48 overflow-auto divide-y">
                    {orphans
                      .slice()
                      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                      .map((o) => (
                        <div key={o.id} className="flex items-start justify-between gap-2 px-2 py-1.5 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium break-words leading-snug">{o.description || "(sem descrição)"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {fmtDate(o.competence_date)} · <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{o.status}</Badge>
                            </p>
                          </div>
                          <span className="font-mono text-xs whitespace-nowrap">{fmt(Math.abs(o.amount))}</span>
                        </div>
                      ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* SECTION A — Matches */}
          <section>
            <header className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                {isCardMode ? "Compras já lançadas no cartão" : "Correspondências encontradas"}
                <Badge variant="secondary" className="text-[10px]">{matchedRows.length}</Badge>
              </h3>
            </header>

            <Alert className="mb-2 py-2 px-3 bg-muted/40 border-muted-foreground/20">
              <Info className="h-3.5 w-3.5" />
              <AlertDescription className="text-[11px] leading-snug ml-1">
                Linhas do extrato que casam com lançamentos já existentes. Por padrão serão <strong>casadas</strong> (atualiza o existente, sem duplicar). Use <strong>"Já existe — não importar"</strong> para descartar a linha do extrato sem mexer no existente, ou <strong>"Importar como novo"</strong> só se for de fato uma segunda compra.
              </AlertDescription>
            </Alert>

            {matchedRows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2 py-3 border rounded-lg bg-muted/20">
                {indexed.some(({ i }) => matches[i]?.best) ? (
                  <>
                    Nenhuma correspondência aceita ainda.
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 ml-2 text-xs"
                      onClick={conciliateAll}
                    >
                      Aceitar sugestões
                    </Button>
                  </>
                ) : (
                  <>Nenhum lançamento existente bate com este extrato.</>
                )}
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {matchedRows.map(({ r, i }) => {
                  const m = matches[i]!;
                  const best = m.best!;
                  const cand = best.candidate;
                  return (
                    <div key={i} className="grid grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)_auto] gap-4 items-start p-3 hover:bg-accent/30">
                      {/* Extrato */}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Extrato</p>
                        <p className="font-medium text-sm break-words leading-snug" title={r.description}>{r.description}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span></p>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
                      {/* EVA */}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                          EVA
                          <Badge
                            variant={cand.status === "Pago" ? "default" : "secondary"}
                            className="text-[9px] px-1 py-0 h-3.5"
                          >
                            {cand.status}
                          </Badge>
                        </p>
                        <p className="font-medium text-sm break-words leading-snug" title={cand.description}>{cand.description}</p>
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
                            {!isCardMode && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 h-7 text-xs gap-1"
                                onClick={() => setManualForRow(i)}
                              >
                                <Search className="h-3 w-3" /> Buscar manualmente
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>

                        {/* Já existe — não importar (primary safe action) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              onClick={() => onActionChange(i, "ignorar")}
                            >
                              <ShieldCheck className="h-3 w-3" /> Já existe — não importar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] text-xs">
                            Mantém o lançamento que já existe no sistema e <strong>descarta esta linha do extrato</strong>. Nada novo é criado.
                          </TooltipContent>
                        </Tooltip>

                        {/* Importar como novo (X — danger / advanced) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onActionChange(i, "criar")}
                            >
                              <X className="h-3 w-3" /> Importar como novo
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] text-xs">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>
                                Desfaz o vínculo e cria um lançamento <strong>NOVO</strong> a partir da linha do extrato. O que já existia continua existindo — <strong>pode gerar duplicata</strong>. Use só se for realmente uma segunda compra.
                              </span>
                            </div>
                          </TooltipContent>
                        </Tooltip>
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

            <Alert className="mb-2 py-2 px-3 bg-amber-500/5 border-amber-500/30">
              <Info className="h-3.5 w-3.5 text-amber-600" />
              <AlertDescription className="text-[11px] leading-snug ml-1">
                Linhas novas do extrato (sem correspondente). Defina <strong>categoria</strong> (e subcategorias se quiser) antes de importar. Ao categorizar uma linha, lançamentos idênticos (mesma descrição e valor) são categorizados automaticamente.
              </AlertDescription>
            </Alert>

            {newRows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2 py-3 border rounded-lg bg-muted/20">
                Nenhum lançamento novo a criar.
              </p>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-muted/40 border-b text-xs">
                      <th className="p-2 text-left font-medium whitespace-nowrap">Data</th>
                      <th className="p-2 text-left font-medium">Descrição</th>
                      <th className="p-2 text-right font-medium whitespace-nowrap">Valor</th>
                      <th className="p-2 text-left font-medium min-w-[200px]">Categoria</th>
                      <th className="p-2 text-center font-medium w-16">Ignorar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRows.map(({ r, i }) => {
                      const sug = suggestions[i];
                      const currentCat = rowCategories[i] || { category: "" };
                      const subs = childrenOf(currentCat.category);
                      const subSubs = childrenOf(currentCat.subcategory);
                      const dupKey = `${r.type}|${Math.abs(r.amount)}|${normalizeText(r.description)}`;
                      const dupCount = duplicateCounts.get(dupKey) || 1;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="p-2 text-muted-foreground whitespace-nowrap text-xs align-top">{fmtDate(r.date)}</td>
                          <td className="p-2 align-top min-w-[280px]">
                            <p className="break-words leading-snug" title={r.description}>{r.description}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant={r.type === "receita" ? "default" : "destructive"} className="text-[9px]">
                                {r.type === "receita" ? "Entrada" : "Saída"}
                              </Badge>
                              {dupCount > 1 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[9px] cursor-help">×{dupCount}</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {dupCount} lançamentos idênticos. Categorize um e os outros serão preenchidos.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono whitespace-nowrap align-top">{fmt(r.amount)}</td>
                          <td className="p-2 align-top">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={currentCat.category || "__none__"}
                                onValueChange={(v) =>
                                  onCategoryChange(i, {
                                    category: v === "__none__" ? "" : v,
                                    subcategory: undefined,
                                    subcategory2: undefined,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sem categoria</SelectItem>
                                  {rootCats.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {subs.length > 0 && (
                                <Select
                                  value={currentCat.subcategory || "__none__"}
                                  onValueChange={(v) =>
                                    onCategoryChange(i, {
                                      category: currentCat.category,
                                      subcategory: v === "__none__" ? undefined : v,
                                      subcategory2: undefined,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Subcategoria" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Subcategoria —</SelectItem>
                                    {subs.map((c) => (
                                      <SelectItem key={c.id} value={c.name}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {subSubs.length > 0 && (
                                <Select
                                  value={currentCat.subcategory2 || "__none__"}
                                  onValueChange={(v) =>
                                    onCategoryChange(i, {
                                      category: currentCat.category,
                                      subcategory: currentCat.subcategory,
                                      subcategory2: v === "__none__" ? undefined : v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Sub-subcategoria" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Sub-sub —</SelectItem>
                                    {subSubs.map((c) => (
                                      <SelectItem key={c.id} value={c.name}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {sug && !currentCat.touched && currentCat.category === sug.category && (
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
                          <td className="p-2 text-center align-top">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Checkbox
                                  checked={false}
                                  onCheckedChange={() => onActionChange(i, "ignorar")}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-[240px]">
                                Não importar esta linha. Ela vai para "Ignorados" e pode ser restaurada.
                              </TooltipContent>
                            </Tooltip>
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
              <Alert className="mb-2 py-2 px-3 bg-muted/20 border-muted-foreground/20">
                <Info className="h-3.5 w-3.5" />
                <AlertDescription className="text-[11px] leading-snug ml-1">
                  Linhas descartadas — não entram na importação. Quando vêm da seção de conciliação, significa que o lançamento existente foi <strong>mantido</strong> no sistema. Clique em <strong>Restaurar</strong> para trazer de volta.
                </AlertDescription>
              </Alert>
              <div className="border rounded-lg divide-y opacity-60">
                {ignoredRows.map(({ r, i }) => {
                  const hadMatch = !!matches[i]?.best;
                  return (
                    <div key={i} className="flex justify-between items-center p-2 text-xs">
                      <span className="truncate flex items-center gap-1.5">
                        {hadMatch && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/40 text-emerald-700">
                            <ShieldCheck className="h-2.5 w-2.5" /> existente mantido
                          </Badge>
                        )}
                        {fmtDate(r.date)} · {r.description}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{fmt(r.amount)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => onActionChange(i, hadMatch ? "vincular" : "criar")}
                        >
                          Restaurar
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
    </TooltipProvider>
  );
}

import { useMemo, useState } from "react";
import {
  Check,
  Link2,
  Plus,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  orphans?: { id: string; description: string; amount: number; competence_date: string; payment_date: string; status: string; category?: string | null; subcategory?: string | null; subcategory2?: string | null }[];
  orphansLoading?: boolean;
  /** Real card bill total/count from the same grouping used on /lancamentos. */
  systemBill?: { total: number; count: number; loading: boolean } | null;
  /** Optional: when provided, shows a "Excluir" button on each orphan. */
  onDeleteOrphan?: (id: string) => void;
  /** Set of system tx IDs already marked for replacement by "Manter só o do extrato". */
  replaceDeleteIds?: Set<string>;
  /** Called when the user chooses to discard the system tx and keep the statement line. */
  onKeepStatementOnly?: (rowIdx: number) => void;
  /** Called to undo a "Manter só o do extrato" choice for a given system tx ID. */
  onUndoKeepStatementOnly?: (systemTxId: string) => void;
  /** Create a category inline. Returns the new record's name (so caller can set it in rowCategories). */
  onCreateCategory?: (params: { name: string; parentName?: string; type?: "receita" | "despesa" }) => Promise<{ id: string; name: string } | null>;
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

function CategoryChain({
  category,
  subcategory,
  subcategory2,
}: {
  category?: string | null;
  subcategory?: string | null;
  subcategory2?: string | null;
}) {
  const parts = [category, subcategory, subcategory2].filter(Boolean) as string[];
  if (parts.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic mt-0.5">sem categoria</p>
    );
  }
  return (
    <p className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-0.5">
      {parts.map((p, idx) => (
        <span key={idx} className="inline-flex items-center gap-0.5">
          {idx > 0 && <span className="opacity-50">›</span>}
          <span className={idx === 0 ? "font-medium text-foreground/70" : ""}>{p}</span>
        </span>
      ))}
    </p>
  );
}

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
  systemBill = null,
  onDeleteOrphan,
  replaceDeleteIds,
  onKeepStatementOnly,
  onUndoKeepStatementOnly,
  onCreateCategory,
}: ReconcileStepProps) {

  const isCardMode = mode === "card";
  const [manualForRow, setManualForRow] = useState<number | null>(null);
  const [showOrphans, setShowOrphans] = useState(true);
  // Rows for which the user explicitly clicked "Criar novo" in the "Provável"
  // section — we drop the suggested match locally so the row moves to
  // "Só no extrato" and can be categorized/imported.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const [createCatState, setCreateCatState] = useState<
    | { rowIdx: number; level: "category" | "subcategory" | "subcategory2"; parentName?: string; type?: "receita" | "despesa" }
    | null
  >(null);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const resolveCategoryLabel = (value?: string | null) => {
    if (!value) return value;
    return categoriesById.get(value) || value;
  };

  // Build indexed list of selected rows
  const indexed = useMemo(
    () =>
      rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.selected),
    [rows]
  );

  // SPLIT matched rows by tier: exact (Q1) vs tolerance (Q2)
  const matchedExactRows = indexed.filter(
    ({ i }) =>
      (matchActions[i] || "criar") === "vincular" &&
      matches[i]?.best &&
      matches[i]!.best!.tier === "exact"
  );
  const matchedToleranceRows = indexed.filter(
    ({ i }) =>
      (matchActions[i] || "criar") === "vincular" &&
      matches[i]?.best &&
      matches[i]!.best!.tier === "tolerance"
  );
  // Rows where matcher found a same-value candidate but text differs — user must confirm.
  const suggestedRows = indexed.filter(({ i }) => {
    if (dismissedSuggestions.has(i)) return false;
    const a = matchActions[i] || "criar";
    return a === "criar" && matches[i]?.best?.suggested;
  });
  const suggestedIdxSet = new Set(suggestedRows.map(({ i }) => i));
  const newRows = indexed.filter(({ i }) => {
    if (suggestedIdxSet.has(i)) return false;
    const a = matchActions[i] || "criar";
    return a === "criar" || (a === "vincular" && !matches[i]?.best);
  });
  const ignoredRows = indexed.filter(({ i }) => matchActions[i] === "ignorar");

  // Sistema × Extrato totals (fatura-level, independent of matcher tier)
  const statementTotal = indexed.reduce((s, { r }) => s + Math.abs(r.amount), 0);
  const matchedSystemTotal = [...matchedExactRows, ...matchedToleranceRows].reduce(
    (s, { i }) => s + Math.abs(Number(matches[i]!.best!.candidate.amount)),
    0
  );
  const orphansTotal = orphans.reduce((s, o) => s + Math.abs(o.amount), 0);
  const systemTotal = isCardMode && systemBill ? Math.abs(systemBill.total) : matchedSystemTotal;
  const systemCount = isCardMode && systemBill ? systemBill.count : matchedExactRows.length + matchedToleranceRows.length;
  const totalsDelta = statementTotal - systemTotal;
  const totalsDivergent = Math.abs(totalsDelta) > 0.05;
  const coverageMatched = matchedExactRows.length + matchedToleranceRows.length;
  const coverageTotal = indexed.length;
  const onlyStatementRows = newRows; // linhas presentes só no extrato

  // Progresso da conciliação (linhas do extrato):
  // - Original = soma de todas as linhas selecionadas do extrato
  // - Conciliado = soma das linhas com ação "vincular" (exact + tolerance + "É o mesmo")
  // - Restante = original − conciliado (o que ainda precisa virar novo/ignorado)
  const reconciledRowsTotal = indexed
    .filter(({ i }) => (matchActions[i] || "criar") === "vincular")
    .reduce((s, { r }) => s + Math.abs(r.amount), 0);
  const reconciledRowsCount = indexed.filter(
    ({ i }) => (matchActions[i] || "criar") === "vincular"
  ).length;
  const remainingTotal = Math.max(0, statementTotal - reconciledRowsTotal);
  const remainingCount = Math.max(0, coverageTotal - reconciledRowsCount);




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

  // Renders a single matched row (used by Q1 + Q2 sections).
  const renderMatchRow = ({ r, i }: { r: ParsedRow; i: number }) => {
    const m = matches[i]!;
    const best = m.best!;
    const cand = best.candidate;
    const delta = r.amount - Number(cand.amount);
    const showDelta = best.tier === "tolerance";
    return (
      <div key={i} className="grid grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)_auto] gap-4 items-start p-3 hover:bg-accent/30">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Extrato</p>
          <p className="font-medium text-sm break-words leading-snug" title={r.description}>{r.description}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span></p>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          {showDelta && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/50 text-amber-700 font-mono">
              Δ {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
            </Badge>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
            EVA
            <Badge variant={cand.status === "Pago" ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-3.5">
              {cand.status}
            </Badge>
            {(cand as any).is_reconciled && (
              <Badge className="text-[9px] px-1 py-0 h-3.5 gap-0.5 bg-sky-600 hover:bg-sky-700 text-white border-0">
                <ShieldCheck className="h-2.5 w-2.5" /> já conciliado
              </Badge>
            )}
          </p>
          <p className="font-medium text-sm break-words leading-snug" title={cand.description}>{cand.description}</p>
          <p className="text-xs text-muted-foreground">
            <span title="Data da compra (competência)">Compra {fmtDate(cand.competence_date || cand.payment_date)}</span>
            {cand.competence_date && cand.payment_date && cand.competence_date !== cand.payment_date && (
              <span className="opacity-60"> · Pgto {fmtDate(cand.payment_date)}</span>
            )}
            {" · "}<span className="font-mono">{fmt(Number(cand.amount))}</span>
            {cand.contact_name ? ` · ${cand.contact_name}` : ""}
          </p>
          <CategoryChain
            category={resolveCategoryLabel(cand.category)}
            subcategory={resolveCategoryLabel((cand as any).subcategory)}
            subcategory2={resolveCategoryLabel((cand as any).subcategory2)}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" title="Escolher outro par de correspondência">
                <ArrowLeftRight className="h-3 w-3" /> Outro par
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
                <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs gap-1" onClick={() => setManualForRow(i)}>
                  <Search className="h-3 w-3" /> Buscar manualmente
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => onActionChange(i, "ignorar")}
              >
                <ShieldCheck className="h-3 w-3" /> Manter só o do sistema
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              Descarta esta linha do extrato. O lançamento que já existe no sistema é mantido — nada é criado nem excluído.
            </TooltipContent>
          </Tooltip>

          {onKeepStatementOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-sky-600 hover:text-sky-700 hover:bg-sky-500/10"
                  onClick={() => onKeepStatementOnly(i)}
                >
                  <Sparkles className="h-3 w-3" /> Manter só o do extrato
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Exclui</strong> o lançamento do sistema e cria um <strong>novo</strong> a partir da linha do extrato (com a mesma categoria). Use quando o do sistema estiver com dados errados (data, valor, descrição).
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onActionChange(i, "criar")}
              >
                <X className="h-3 w-3" /> É outra compra — criar
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
  };


  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Header summary */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            {isCardMode ? "Conciliação & categorização" : "Conciliação assistida"}
            {(matchLoading || suggestLoading) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cada linha do extrato vira uma ação no seu sistema:{" "}
            <strong>conciliar com lançamento existente</strong>, <strong>criar como nova compra</strong>{" "}
            ou <strong>manter só o do sistema</strong>. Revise antes de confirmar.
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
          {/* Progresso da conciliação — linhas do extrato (ambos os modos) */}
          {coverageTotal > 0 && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Progresso da conciliação
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {reconciledRowsCount}/{coverageTotal} linha{coverageTotal === 1 ? "" : "s"} conciliada{reconciledRowsCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Extrato original</p>
                  <p className="font-mono text-sm">{fmt(statementTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">{coverageTotal} linha{coverageTotal === 1 ? "" : "s"} selecionada{coverageTotal === 1 ? "" : "s"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700">Já conciliado</p>
                  <p className="font-mono text-sm text-emerald-700">− {fmt(reconciledRowsTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">{reconciledRowsCount} vinculada{reconciledRowsCount === 1 ? "" : "s"} ao sistema</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Restante a tratar</p>
                  <p className={`font-mono text-sm ${remainingTotal < 0.01 ? "text-emerald-700" : "text-foreground"}`}>
                    {fmt(remainingTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {remainingCount === 0 ? "tudo resolvido" : `${remainingCount} linha${remainingCount === 1 ? "" : "s"} pendente${remainingCount === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              {/* Barra de progresso */}
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${statementTotal > 0 ? Math.min(100, (reconciledRowsTotal / statementTotal) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Sistema × Extrato — fatura-level summary (card mode) */}
          {isCardMode && (
            <div
              className={`rounded-lg border p-3 ${
                totalsDivergent
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {totalsDivergent ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Check className="h-4 w-4 text-emerald-600" />
                  )}
                  Sistema × Extrato
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {coverageMatched}/{coverageTotal} linhas conciliadas
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sistema</p>
                  <p className="font-mono text-sm">
                    {systemBill?.loading ? "carregando..." : fmt(-systemTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {systemCount} lançamento{systemCount === 1 ? "" : "s"} na fatura do sistema
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Extrato</p>
                  <p className="font-mono text-sm">{fmt(statementTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {indexed.length} linhas selecionadas
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Diferença</p>
                  <p className={`font-mono text-sm ${totalsDivergent ? "text-amber-700" : "text-emerald-700"}`}>
                    {totalsDelta >= 0 ? "+" : ""}
                    {fmt(totalsDelta)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {totalsDivergent ? "revise as prováveis causas" : "bate certinho"}
                  </p>
                </div>
              </div>
              {totalsDivergent && (onlyStatementRows.length > 0 || orphans.length > 0) && (
                <div className="mt-2 text-[11px] text-muted-foreground border-t border-amber-500/20 pt-2 space-y-0.5">
                  <p className="font-medium text-foreground">Prováveis causas da divergência:</p>
                  {onlyStatementRows.length > 0 && (
                    <p>
                      • {onlyStatementRows.length} linha{onlyStatementRows.length === 1 ? "" : "s"} só no extrato ({fmt(onlyStatementRows.reduce((s, { r }) => s + Math.abs(r.amount), 0))})
                    </p>
                  )}
                  {orphans.length > 0 && (
                    <p>
                      • {orphans.length} lançamento{orphans.length === 1 ? "" : "s"} só no sistema para revisão ({fmt(orphansTotal)})
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Matrix legend */}
          <Alert className="py-2 px-3 bg-muted/30 border-muted-foreground/20">
            <Info className="h-3.5 w-3.5" />
            <AlertDescription className="text-[11px] leading-snug ml-1">
              Cada linha cai em um dos 4 cenários: <strong className="text-emerald-700">Igual — pode conciliar</strong> ·{" "}
              <strong className="text-amber-700">Divergência de centavos</strong> ·{" "}
              <strong className="text-sky-700">Só no extrato</strong> ·{" "}
              <strong className="text-destructive">Só no sistema</strong>.
            </AlertDescription>
          </Alert>

          {/* Q1 — IGUAL, PODE CONCILIAR */}
          <section>
            <header className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                <Check className="h-4 w-4" />
                Igual — pode conciliar
                <Badge variant="secondary" className="text-[10px]">{matchedExactRows.length}</Badge>
                <span className="text-[10px] text-muted-foreground font-normal">
                  — valor idêntico, casa direto · cobertura {coverageMatched}/{coverageTotal}
                </span>
              </h3>
            </header>

            {matchedExactRows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2 py-3 border rounded-lg bg-muted/20">
                {indexed.some(({ i }) => matches[i]?.best && matches[i]!.best!.tier === "exact") ? (
                  <>
                    Há sugestões exatas não aceitas.{" "}
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={conciliateAll}>
                      Aceitar sugestões
                    </Button>
                  </>
                ) : (
                  <>Nenhuma correspondência exata encontrada.</>
                )}
              </p>
            ) : (
              <div className="border border-emerald-500/30 rounded-lg overflow-hidden divide-y">
                {matchedExactRows.map(renderMatchRow)}
              </div>
            )}
          </section>

          {/* Q2 — TOLERÂNCIA DE CENTAVOS */}
          {matchedToleranceRows.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Diferença de centavos
                  <Badge variant="secondary" className="text-[10px]">{matchedToleranceRows.length}</Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">— provável desconto/juros, revise antes de casar</span>
                </h3>
              </header>
              <Alert className="mb-2 py-2 px-3 bg-amber-500/5 border-amber-500/30">
                <Info className="h-3.5 w-3.5 text-amber-600" />
                <AlertDescription className="text-[11px] leading-snug ml-1">
                  Casa pelo valor próximo (até R$ 0,05 de diferença). Pode ser desconto por pontualidade ou pequeno juros. Confirme manualmente se quiser absorver a diferença, ou use <strong>"É outra compra — criar"</strong> se forem compras distintas.
                </AlertDescription>
              </Alert>

              <div className="border border-amber-500/30 rounded-lg overflow-hidden divide-y">
                {matchedToleranceRows.map(renderMatchRow)}
              </div>
            </section>
          )}


          {/* PROVÁVEL — valor+data batem, mas nome diverge. Confirmar. */}
          {suggestedRows.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                  <Link2 className="h-4 w-4" />
                  Provável — confirmar
                  <Badge variant="secondary" className="text-[10px]">{suggestedRows.length}</Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    — valor e data batem, mas o nome diverge
                  </span>
                </h3>
              </header>
              <Alert className="mb-2 py-2 px-3 bg-amber-500/5 border-amber-500/30">
                <Info className="h-3.5 w-3.5 text-amber-600" />
                <AlertDescription className="text-[11px] leading-snug ml-1">
                  <strong>Atenção à data de pagamento.</strong> Achamos um lançamento no sistema com o mesmo valor e data próxima, mas descrição diferente. Confira se as duas linhas são da <strong>mesma fatura</strong> — pode ser uma compra parecida de outro mês. Se for a mesma compra, clique em <strong>"É o mesmo"</strong>. Se for uma compra nova (mesmo que parecida), clique em <strong>"Criar novo"</strong>.
                </AlertDescription>
              </Alert>

              <div className="border border-amber-500/30 rounded-lg overflow-hidden divide-y bg-amber-500/[0.02]">
                {suggestedRows.map(({ r, i }) => {
                  const cand = matches[i]!.best!.candidate;
                  const candDate = cand.competence_date || cand.payment_date;
                  const daysOff = Math.round(
                    (new Date(r.date + "T00:00:00").getTime() -
                      new Date(candDate + "T00:00:00").getTime()) /
                      86400000
                  );
                  // "Different month" flag: helps the user spot that the system
                  // candidate is likely from a previous/next bill cycle.
                  const differentMonth =
                    r.date.slice(0, 7) !== (candDate || "").slice(0, 7);
                  return (
                    <div key={i} className="grid grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)_auto] gap-4 items-start p-3 hover:bg-accent/30">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Extrato</p>
                        <p className="font-medium text-sm break-words leading-snug" title={r.description}>{r.description}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span></p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <ArrowLeftRight className="h-4 w-4 text-amber-600" />
                        {daysOff !== 0 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/50 text-amber-700 font-mono">
                            {daysOff > 0 ? "+" : ""}{daysOff}d
                          </Badge>
                        )}
                        {differentMonth && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-amber-600 text-amber-800 bg-amber-500/10 gap-0.5"
                            title="A data do extrato e a do sistema caem em meses diferentes — provavelmente faturas diferentes."
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> mês diferente
                          </Badge>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                          EVA
                          <Badge variant={cand.status === "Pago" ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-3.5">
                            {cand.status}
                          </Badge>
                        </p>
                        <p className="font-medium text-sm break-words leading-snug" title={cand.description}>{cand.description}</p>
                        <p className="text-xs text-muted-foreground">
                          <span title="Data da compra (competência)">Compra {fmtDate(cand.competence_date || cand.payment_date)}</span>
                          {cand.competence_date && cand.payment_date && cand.competence_date !== cand.payment_date && (
                            <span className="opacity-60"> · Pgto {fmtDate(cand.payment_date)}</span>
                          )}
                          {" · "}<span className="font-mono">{fmt(Number(cand.amount))}</span>
                          {cand.contact_name ? ` · ${cand.contact_name}` : ""}
                        </p>
                        <CategoryChain
                          category={resolveCategoryLabel(cand.category)}
                          subcategory={resolveCategoryLabel((cand as any).subcategory)}
                          subcategory2={resolveCategoryLabel((cand as any).subcategory2)}
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-emerald-500/60 text-emerald-700 hover:bg-emerald-500/10"
                          onClick={() => {
                            onTargetChange(i, cand.id);
                            onActionChange(i, "vincular");
                          }}
                        >
                          <Link2 className="h-3 w-3" /> É o mesmo
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-sky-500/60 text-sky-700 hover:bg-sky-500/10"
                          onClick={() => {
                            onTargetChange(i, null as any);
                            onActionChange(i, "criar");
                            setDismissedSuggestions((prev) => {
                              const next = new Set(prev);
                              next.add(i);
                              return next;
                            });
                          }}
                          title="Criar como novo lançamento — a linha vai para a seção 'Só no extrato' para você categorizar."
                        >
                          <Plus className="h-3 w-3" /> Criar novo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => onActionChange(i, "ignorar")}
                        >
                          <X className="h-3 w-3" /> Ignorar
                        </Button>
                      </div>
                    </div>
                  );
                })}

              </div>
            </section>
          )}


          <section>
            <header className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-sky-700">
                <Sparkles className="h-4 w-4" />
                Só no extrato — o que fazer?
                <Badge variant="secondary" className="text-[10px]">{newRows.length}</Badge>
                {suggestLoading && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" /> sugerindo categorias...
                  </span>
                )}
              </h3>
            </header>

            <Alert className="mb-2 py-2 px-3 bg-sky-500/5 border-sky-500/30">
              <Info className="h-3.5 w-3.5 text-sky-600" />
              <AlertDescription className="text-[11px] leading-snug ml-1">
                Estas linhas estão no extrato mas <strong>não têm correspondente no sistema</strong>. Escolha o que fazer com cada uma:
                <strong> lançar e categorizar</strong> (padrão) definindo categoria abaixo, ou <strong>ignorar</strong> se não deve ser importada.
                Se for o mesmo lançamento já existente com data errada, use "É o mesmo" na seção <em>Só no sistema</em>.
                Ao categorizar uma linha, lançamentos idênticos são preenchidos automaticamente.
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
                      <th className="p-2 text-center font-medium w-[190px]">Ação</th>
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
                      const replacingCandId = matches[i]?.best?.candidate?.id;
                      const isReplacing = !!(
                        replacingCandId && replaceDeleteIds?.has(replacingCandId)
                      );
                      return (
                        <tr key={i} className={`border-b last:border-0 hover:bg-accent/30 ${isReplacing ? "bg-sky-500/5" : ""}`}>
                          <td className="p-2 text-muted-foreground whitespace-nowrap text-xs align-top">{fmtDate(r.date)}</td>
                          <td className="p-2 align-top min-w-[280px]">
                            <p className="break-words leading-snug" title={r.description}>{r.description}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
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
                              {isReplacing && (
                                <Badge className="text-[9px] gap-0.5 bg-sky-600 hover:bg-sky-700 text-white border-0">
                                  substituindo lançamento do sistema
                                  {onUndoKeepStatementOnly && replacingCandId && (
                                    <button
                                      type="button"
                                      onClick={() => onUndoKeepStatementOnly(replacingCandId)}
                                      className="ml-1 underline decoration-dotted hover:no-underline"
                                      title="Desfazer substituição"
                                    >
                                      desfazer
                                    </button>
                                  )}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono whitespace-nowrap align-top">{fmt(r.amount)}</td>
                          <td className="p-2 align-top">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={currentCat.category || "__none__"}
                                onValueChange={(v) => {
                                  if (v === "__create__") {
                                    setCreateCatState({ rowIdx: i, level: "category", type: r.type });
                                    setNewCatName("");
                                    return;
                                  }
                                  onCategoryChange(i, {
                                    category: v === "__none__" ? "" : v,
                                    subcategory: undefined,
                                    subcategory2: undefined,
                                  });
                                }}
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
                                  {onCreateCategory && (
                                    <SelectItem value="__create__" className="text-primary font-medium">
                                      <span className="flex items-center gap-1.5"><Plus className="h-3 w-3" /> Criar nova</span>
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>

                              {(subs.length > 0 || (onCreateCategory && currentCat.category)) && (
                                <Select
                                  value={currentCat.subcategory || "__none__"}
                                  onValueChange={(v) => {
                                    if (v === "__create__") {
                                      setCreateCatState({ rowIdx: i, level: "subcategory", parentName: currentCat.category });
                                      setNewCatName("");
                                      return;
                                    }
                                    onCategoryChange(i, {
                                      category: currentCat.category,
                                      subcategory: v === "__none__" ? undefined : v,
                                      subcategory2: undefined,
                                    });
                                  }}
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
                                    {onCreateCategory && currentCat.category && (
                                      <SelectItem value="__create__" className="text-primary font-medium">
                                        <span className="flex items-center gap-1.5"><Plus className="h-3 w-3" /> Criar subcategoria</span>
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {(subSubs.length > 0 || (onCreateCategory && currentCat.subcategory)) && (
                                <Select
                                  value={currentCat.subcategory2 || "__none__"}
                                  onValueChange={(v) => {
                                    if (v === "__create__") {
                                      setCreateCatState({ rowIdx: i, level: "subcategory2", parentName: currentCat.subcategory });
                                      setNewCatName("");
                                      return;
                                    }
                                    onCategoryChange(i, {
                                      category: currentCat.category,
                                      subcategory: currentCat.subcategory,
                                      subcategory2: v === "__none__" ? undefined : v,
                                    });
                                  }}
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
                                    {onCreateCategory && currentCat.subcategory && (
                                      <SelectItem value="__create__" className="text-primary font-medium">
                                        <span className="flex items-center gap-1.5"><Plus className="h-3 w-3" /> Criar sub-subcategoria</span>
                                      </SelectItem>
                                    )}
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] gap-1 text-sky-700 hover:text-sky-800 hover:bg-sky-500/10"
                                  onClick={() => onActionChange(i, "ignorar")}
                                >
                                  <ShieldCheck className="h-3 w-3" /> Manter só do extrato
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-[260px]">
                                Reconhece que essa linha existe só no extrato e <strong>não deve virar lançamento no sistema</strong>. Nada é criado, nada é excluído. Fica registrada em "Ignorados" e pode ser restaurada.
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


          {/* Q4 — SÓ NO SISTEMA (orphans) */}
          {isCardMode && !orphansLoading && orphans.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Só no sistema
                  <Badge variant="secondary" className="text-[10px]">{orphans.length}</Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    — {orphans.reduce((s, o) => s + Math.abs(o.amount), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </h3>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowOrphans((v) => !v)}>
                  {showOrphans ? "Ocultar" : "Mostrar"}
                </Button>
              </header>
              <Alert className="mb-2 py-2 px-3 bg-destructive/5 border-destructive/30">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <AlertDescription className="text-[11px] leading-snug ml-1">
                  Lançamentos que existem no sistema mas <strong>não aparecem no extrato</strong>. Costumam ser erros (digitação duplicada, importação anterior corrompida, ghost de recuperação) ou pertencem a outra fatura. Exclua os incorretos para a fatura bater certinho.
                </AlertDescription>
              </Alert>
              {showOrphans && (
                <div className="border border-destructive/30 rounded-lg bg-background max-h-96 overflow-auto divide-y">
                  {orphans
                    .slice()
                    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                    .map((o) => {
                      // Cruzar por valor: linhas "só no extrato" com o mesmo valor absoluto.
                      const valueMatches = onlyStatementRows.filter(
                        ({ r }) => Math.abs(Math.abs(r.amount) - Math.abs(o.amount)) <= 0.05
                      );
                      return (
                        <div key={o.id} className="px-2 py-2 text-xs space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium break-words leading-snug">{o.description || "(sem descrição)"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                <span title="Data da compra (competência)">Compra {fmtDate(o.competence_date)}</span>
                                {o.payment_date && o.payment_date !== o.competence_date && (
                                  <span className="opacity-60"> · Pgto {fmtDate(o.payment_date)}</span>
                                )}
                                {" · "}<Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{o.status}</Badge>
                              </p>
                              <CategoryChain
                                category={resolveCategoryLabel(o.category)}
                                subcategory={resolveCategoryLabel(o.subcategory)}
                                subcategory2={resolveCategoryLabel(o.subcategory2)}
                              />
                            </div>
                            <span className="font-mono text-xs whitespace-nowrap self-center">{fmt(Math.abs(o.amount))}</span>
                            {onDeleteOrphan && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onDeleteOrphan(o.id)}
                                  >
                                    <X className="h-3 w-3" /> Excluir
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-[240px]">
                                  Remove o lançamento do sistema. Use quando for um ghost/duplicata. Esta ação não pode ser desfeita aqui.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          {valueMatches.length > 0 && (
                            <div className="ml-2 pl-2 border-l-2 border-amber-500/40 space-y-1 bg-amber-500/5 rounded-r py-1.5 pr-1.5">
                              <p className="text-[10px] font-medium text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Mesmo valor no extrato — pode ser o mesmo lançamento com data errada
                              </p>
                              {valueMatches.map(({ r, i }) => {
                                const daysOff = Math.round(
                                  (new Date(r.date + "T00:00:00").getTime() -
                                    new Date(o.competence_date + "T00:00:00").getTime()) /
                                    86400000
                                );
                                return (
                                  <div
                                    key={i}
                                    className="flex items-start justify-between gap-2 bg-background rounded px-2 py-1.5 border border-amber-500/20"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium break-words leading-snug" title={r.description}>
                                        {r.description}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span>
                                        {daysOff !== 0 && (
                                          <span className="ml-1 text-amber-700">
                                            ({daysOff > 0 ? "+" : ""}{daysOff}d vs sistema)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[11px] gap-1 border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10"
                                            onClick={() => {
                                              onTargetChange(i, o.id);
                                              onActionChange(i, "vincular");
                                            }}
                                          >
                                            <Link2 className="h-3 w-3" /> É o mesmo
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[260px] text-xs">
                                          Vincula esta linha do extrato ao lançamento existente. Útil quando o lançamento foi feito na data errada.
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}


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
                        {hadMatch ? (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/40 text-emerald-700">
                            <ShieldCheck className="h-2.5 w-2.5" /> existente mantido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-sky-500/40 text-sky-700">
                            <ShieldCheck className="h-2.5 w-2.5" /> só do extrato mantido
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

        {suggestLoading && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-md bg-background/50"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-card/80 px-6 py-5 shadow-xl backdrop-blur-xl max-w-sm text-center">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <Sparkles className="h-4 w-4 text-primary absolute -right-1 -top-1 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  EVA está categorizando {rows.length} lançamento{rows.length === 1 ? "" : "s"}…
                </p>
                <p className="text-xs text-muted-foreground">
                  Isso pode levar alguns segundos em extratos grandes.
                </p>
              </div>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-primary animate-[shimmer_1.4s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!createCatState} onOpenChange={(o) => !o && setCreateCatState(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {createCatState?.level === "category" && "Nova categoria"}
              {createCatState?.level === "subcategory" && `Nova subcategoria em "${createCatState.parentName}"`}
              {createCatState?.level === "subcategory2" && `Nova sub-subcategoria em "${createCatState.parentName}"`}
            </DialogTitle>
            <DialogDescription>
              Cadastre uma categoria sem sair da importação. Ela ficará disponível para os próximos lançamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Ex: Alimentação"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim() && !creatingCat) {
                  e.preventDefault();
                  (async () => {
                    if (!createCatState || !onCreateCategory) return;
                    setCreatingCat(true);
                    const res = await onCreateCategory({
                      name: newCatName.trim(),
                      parentName: createCatState.parentName,
                      type: createCatState.type,
                    });
                    setCreatingCat(false);
                    if (!res) return;
                    const row = rowCategories[createCatState.rowIdx] || { category: "" };
                    if (createCatState.level === "category") {
                      onCategoryChange(createCatState.rowIdx, { ...row, category: res.name, subcategory: undefined, subcategory2: undefined });
                    } else if (createCatState.level === "subcategory") {
                      onCategoryChange(createCatState.rowIdx, { ...row, subcategory: res.name, subcategory2: undefined });
                    } else {
                      onCategoryChange(createCatState.rowIdx, { ...row, subcategory2: res.name });
                    }
                    setCreateCatState(null);
                    setNewCatName("");
                  })();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCatState(null)} disabled={creatingCat}>Cancelar</Button>
            <Button
              disabled={!newCatName.trim() || creatingCat}
              onClick={async () => {
                if (!createCatState || !onCreateCategory) return;
                setCreatingCat(true);
                const res = await onCreateCategory({
                  name: newCatName.trim(),
                  parentName: createCatState.parentName,
                  type: createCatState.type,
                });
                setCreatingCat(false);
                if (!res) {
                  toast({ title: "Não foi possível criar a categoria", variant: "destructive" });
                  return;
                }
                const row = rowCategories[createCatState.rowIdx] || { category: "" };
                if (createCatState.level === "category") {
                  onCategoryChange(createCatState.rowIdx, { ...row, category: res.name, subcategory: undefined, subcategory2: undefined });
                } else if (createCatState.level === "subcategory") {
                  onCategoryChange(createCatState.rowIdx, { ...row, subcategory: res.name, subcategory2: undefined });
                } else {
                  onCategoryChange(createCatState.rowIdx, { ...row, subcategory2: res.name });
                }
                setCreateCatState(null);
                setNewCatName("");
              }}
            >
              {creatingCat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}


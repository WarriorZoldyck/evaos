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
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NeuToggle } from "@/components/ui/neu-toggle";
import { buildCategoryIndex, resolveChain, childrenOfId } from "@/lib/categoryChain";


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
import { CategoryPathCombobox } from "@/components/lancamentos/CategoryPathCombobox";
import { CategoryCascadeSelect } from "@/components/lancamentos/import/CategoryCascadeSelect";
import { ContactSelectWithCreate } from "@/components/lancamentos/ContactSelectWithCreate";
import { SuggestionWhyPopover } from "@/components/lancamentos/import/SuggestionWhyPopover";
import { GroupMatchDialog, type GroupDialogRow } from "@/components/lancamentos/import/GroupMatchDialog";
import {
  collectGroupedRows,
  collectGroupedSystemIds,
  sumAmounts,
  type GroupsMap,
} from "@/lib/import/grouping";
import type { CandidateTx } from "@/lib/import/matching";
import { effectiveAction as sharedEffectiveAction } from "@/lib/import/disposition";


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
  /** Edited (user-friendly) descriptions per row, applied when creating the transaction. */
  rowDescriptions?: Record<number, string>;
  /** Selected supplier/client per row, applied when creating the transaction. */
  rowContacts?: Record<number, { supplier_id?: string | null; client_id?: string | null }>;
  /** Rows already reviewed/confirmed — locked from further editing until unlocked. */
  reviewedRows?: Set<number>;
  /** DEPRECATED: no-op. Kept for compatibility. */
  onOpenReview?: (rowIdx: number) => void;
  /** Called when the user confirms the inline review panel. */
  onReviewConfirm?: (rowIdx: number, result: {
    description: string;
    category: RowCategoryValue;
    contact: { supplier_id?: string | null; client_id?: string | null };
  }) => void;
  /** Called when the user cancels the inline review panel (before confirming). */
  onReviewCancel?: (rowIdx: number) => void;
  /** Called to toggle a row's reviewed/locked state directly (no panel). */
  onSetReviewed?: (rowIdx: number, reviewed: boolean) => void;
  /** Update the pending inline description of a row (before it's committed). */
  onDescriptionChange?: (rowIdx: number, description: string) => void;
  /** Update the pending inline contact of a row (before it's committed). */
  onContactChange?: (rowIdx: number, contact: { supplier_id?: string | null; client_id?: string | null }) => void;
  /** Set of rows the user consciously marked as "Ignorar de vez". */
  explicitlyIgnored?: Set<number>;
  /** Toggle a row into/out of the explicit-ignore set. */
  onExplicitIgnore?: (rowIdx: number, ignored: boolean) => void;
  /** Linhas cuja impressão digital já existe no sistema (extrato reimportado). */
  duplicateRows?: Set<number>;
  /** Linhas sugeridas como transferência interna → motivo da sugestão. */
  transferRows?: Record<number, string>;
  /** Linhas em que o usuário recusou a sugestão de transferência. */
  transferDismissed?: Set<number>;
  /** Aceita/recusa a sugestão de transferência interna de uma linha. */
  onTransferDismiss?: (rowIdx: number, dismissed: boolean) => void;

  /** Called when a supplier/client is created inline. */
  onContactCreated?: (type: "supplier" | "client", id: string, name: string) => void;
  /** Suppliers/clients lists to render the small "vinculado a" hint. */
  suppliers?: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
  /** Fase 3 — grupos de conciliação em lote, indexados pela linha-líder. */
  groups?: GroupsMap;
  /** Pool de lançamentos do sistema na janela do extrato (base do agrupamento). */
  groupCandidates?: CandidateTx[];
  /** Confirma um grupo (1↔N). */
  onGroupConfirm?: (leaderIdx: number, state: { systemIds: string[]; extraRowIdx: number[] }) => void;
  /** Desfaz um grupo confirmado. */
  onGroupUndo?: (leaderIdx: number) => void;
}




const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const signedStatementAmount = (row: { amount: number; type: "receita" | "despesa" }) =>
  row.type === "receita" ? -Math.abs(row.amount) : Math.abs(row.amount);

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

function InlineReviewRow({
  rowIdx,
  row,
  categories,
  suppliers,
  clients,
  initialDescription,
  initialCategory,
  initialContact,
  isReviewed,
  onCreateCategory,
  onContactCreated,
  onCancel,
  onConfirm,
}: {
  rowIdx: number;
  row: ParsedRow;
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  initialDescription: string;
  initialCategory: RowCategoryValue;
  initialContact: { supplier_id?: string | null; client_id?: string | null };
  isReviewed: boolean;
  onCreateCategory?: (params: { name: string; parentName?: string; type?: "receita" | "despesa" }) => Promise<{ id: string; name: string } | null>;
  onContactCreated?: (type: "supplier" | "client", id: string, name: string) => void;
  onCancel: () => void;
  onConfirm: (result: {
    description: string;
    category: RowCategoryValue;
    contact: { supplier_id?: string | null; client_id?: string | null };
  }) => void;
}) {
  const rawDescription = row.description;
  const [description, setDescription] = useState(initialDescription || rawDescription);
  const [category, setCategory] = useState<RowCategoryValue>(initialCategory || { category: "" });
  const [supplierId, setSupplierId] = useState<string>(initialContact?.supplier_id || "");
  const [clientId, setClientId] = useState<string>(initialContact?.client_id || "");
  const isReceita = row.type === "receita";

  const handleConfirm = () => {
    const desc = description.trim() || rawDescription;
    onConfirm({
      description: desc,
      category: { ...category, touched: true },
      contact: {
        supplier_id: !isReceita ? (supplierId || null) : null,
        client_id: isReceita ? (clientId || null) : null,
      },
    });
  };

  return (
    <tr className="border-b last:border-0 bg-primary/[0.03]">
      <td colSpan={5} className="p-4">
        <div className="rounded-lg border border-primary/30 bg-background p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {isReviewed ? "Editar revisão do lançamento" : "Revisar novo lançamento"}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar revisão"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Confirme a descrição, o {isReceita ? "cliente" : "fornecedor"} e a categoria antes de importar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`review-desc-${rowIdx}`} className="text-xs">Descrição</Label>
              <Input
                id={`review-desc-${rowIdx}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Formatura Ana"
                autoFocus
                className="h-9"
              />
              {rawDescription && rawDescription !== description && (
                <p className="text-[10px] text-muted-foreground">
                  Original: <span className="font-mono">{rawDescription}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{isReceita ? "Cliente" : "Fornecedor"}</Label>
              {isReceita ? (
                <ContactSelectWithCreate
                  contacts={clients}
                  value={clientId}
                  onChange={setClientId}
                  type="client"
                  placeholder="Selecione o cliente"
                  onContactCreated={(id, name) => {
                    setClientId(id);
                    onContactCreated?.("client", id, name);
                  }}
                />
              ) : (
                <ContactSelectWithCreate
                  contacts={suppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  type="supplier"
                  placeholder="Selecione o fornecedor"
                  onContactCreated={(id, name) => {
                    setSupplierId(id);
                    onContactCreated?.("supplier", id, name);
                  }}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <CategoryCascadeSelect
                categories={categories}
                value={category}
                type={row.type}
                onChange={(v) => setCategory(v)}
                onCreateCategory={onCreateCategory}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Confirmar revisão
            </Button>
          </div>
        </div>
      </td>
    </tr>
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
  rowDescriptions = {},
  rowContacts = {},
  reviewedRows,
  onOpenReview,
  onReviewConfirm,
  onReviewCancel,
  onSetReviewed,
  onDescriptionChange,
  onContactChange,
  onContactCreated,
  explicitlyIgnored,
  onExplicitIgnore,
  duplicateRows,
  transferRows,
  transferDismissed,
  onTransferDismiss,
  suppliers = [],
  clients = [],
  groups = {},
  groupCandidates = [],
  onGroupConfirm,
  onGroupUndo,
}: ReconcileStepProps) {

  const isCardMode = mode === "card";
  const [manualForRow, setManualForRow] = useState<number | null>(null);
  const [groupForRow, setGroupForRow] = useState<number | null>(null);
  const [showOrphans, setShowOrphans] = useState(true);
  // Row currently expanded for inline review (legacy — kept only for manual re-open path).
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Rows for which the user explicitly clicked "Criar novo" in the "Provável"
  // section — we drop the suggested match locally so the row moves to
  // "Só no extrato" and can be categorized/imported.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  // Orphan tx IDs the user has manually linked via "É o mesmo".
  const [linkedOrphans, setLinkedOrphans] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Unified "É o mesmo" handler — used in all three sections.
  // Marks the extract row as reconciled against the given system tx id.
  const handleMarkSame = (rowIdx: number, targetTxId: string) => {
    onTargetChange(rowIdx, targetTxId);
    onActionChange(rowIdx, "vincular");
    setExpandedRowId(null);
    setManualForRow(null);
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(rowIdx);
      return next;
    });
    setLinkedOrphans((prev) => {
      const next = new Set(prev);
      next.add(targetTxId);
      return next;
    });
    toast({
      title: "Vinculado",
      description: "Movemos para resolvidos e será conciliado ao importar.",
    });
  };
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
  const orphansById = useMemo(
    () => new Map(orphans.map((o) => [o.id, o])),
    [orphans],
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

  // Fase 3 — linhas e lançamentos presos em grupos de conciliação em lote.
  // Elas saem das listas de classificação normais (não viram "criar"/"ignorar")
  // e passam a viver na seção "Agrupadas".
  const groupedRowIdx = useMemo(() => collectGroupedRows(groups), [groups]);
  const groupedSystemIds = useMemo(() => collectGroupedSystemIds(groups), [groups]);
  const indexedUngrouped = useMemo(
    () => indexed.filter(({ i }) => !groupedRowIdx.has(i)),
    [indexed, groupedRowIdx],
  );
  const groupLeaders = useMemo(
    () =>
      Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b)
        .filter((i) => rows[i]),
    [groups, rows],
  );
  const groupCandidatesById = useMemo(
    () => new Map(groupCandidates.map((c) => [String(c.id), c])),
    [groupCandidates],
  );
  /**
   * Decisão efetiva da linha — MESMA regra usada pelo salvamento.
   * Antes a tela assumia "criar" e o commit assumia "ignorar": linhas
   * apareciam confirmadas e não eram importadas.
   */
  const actionOf = (i: number) =>
    sharedEffectiveAction(matchActions[i], reviewedRows?.has(i));

  /** IDs já usados por outro vínculo (match confirmado, "É o mesmo" ou outro grupo). */
  const claimedSystemIds = useMemo(() => {
    const out = new Set<string>();
    Object.entries(matchTargets || {}).forEach(([k, id]) => {
      if (id && actionOf(Number(k)) === "vincular") out.add(String(id));
    });
    Object.entries(matches || {}).forEach(([k, m]) => {
      const idx = Number(k);
      if ((actionOf(idx)) === "vincular" && m?.best?.candidate?.id) {
        out.add(String(m.best.candidate.id));
      }
    });
    Object.entries(groups).forEach(([k, g]) => {
      if (Number(k) === groupForRow) return; // permite editar o próprio grupo
      g.systemIds.forEach((id) => out.add(String(id)));
    });
    return out;
  }, [matchTargets, matchActions, matches, groups, groupForRow]);

  const availableGroupCandidates = useMemo(
    () => groupCandidates.filter((c) => !claimedSystemIds.has(String(c.id))),
    [groupCandidates, claimedSystemIds],
  );

  /** Linhas do extrato ainda livres para entrar no grupo em edição (Caso B). */
  const availableGroupRows: GroupDialogRow[] = useMemo(() => {
    if (groupForRow === null) return [];
    const ownExtras = new Set(groups[groupForRow]?.extraRowIdx ?? []);
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => {
        if (!r.selected || i === groupForRow) return false;
        if (ownExtras.has(i)) return true;
        if (groupedRowIdx.has(i)) return false;
        return (actionOf(i)) !== "vincular";
      })
      .map(({ r, i }) => ({
        index: i,
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
      }));
  }, [rows, groupForRow, groups, groupedRowIdx, matchActions]);

  const groupedStatementTotal = useMemo(
    () => sumAmounts([...groupedRowIdx].map((i) => rows[i]?.amount ?? 0)),
    [groupedRowIdx, rows],
  );

  // SPLIT matched rows by tier: exact (Q1) vs tolerance (Q2).
  // We exclude rows the user explicitly confirmed via "É o mesmo" (they show
  // in the dedicated "Vinculadas manualmente" section for clear feedback).
  const matchedExactRows = indexedUngrouped.filter(
    ({ i }) =>
      (actionOf(i)) === "vincular" &&
      matches[i]?.best &&
      matches[i]!.best!.tier === "exact" &&
      !dismissedSuggestions.has(i)
  );
  const matchedToleranceRows = indexedUngrouped.filter(
    ({ i }) =>
      (actionOf(i)) === "vincular" &&
      matches[i]?.best &&
      matches[i]!.best!.tier === "tolerance" &&
      !dismissedSuggestions.has(i)
  );
  // Rows where matcher found a same-value candidate but text differs — user must confirm.
  const suggestedRows = indexedUngrouped.filter(({ i }) => {
    if (dismissedSuggestions.has(i)) return false;
    const a = actionOf(i);
    return a === "criar" && matches[i]?.best?.suggested;
  });
  const suggestedIdxSet = new Set(suggestedRows.map(({ i }) => i));
  // Rows manually linked via "É o mesmo": either against an orphan (no match)
  // OR against an auto-suggested candidate that the user confirmed. Both
  // deserve explicit visual feedback so the click doesn't feel silent.
  const manualLinkedRows = indexedUngrouped.filter(({ i }) => {
    const a = actionOf(i);
    if (a !== "vincular" || !matchTargets[i]) return false;
    if (!matches[i]?.best) return true; // orphan link
    return dismissedSuggestions.has(i); // suggested → user confirmed
  });
  const manualLinkedIdxSet = new Set(manualLinkedRows.map(({ i }) => i));

  const newRows = indexedUngrouped.filter(({ i }) => {
    if (suggestedIdxSet.has(i)) return false;
    if (manualLinkedIdxSet.has(i)) return false;
    const a = actionOf(i);
    if (a === "ignorar") {
      return !matches[i]?.best || dismissedSuggestions.has(i);
    }
    return a === "criar" || (a === "vincular" && !matches[i]?.best);
  });
  const newRowIdxSet = new Set(newRows.map(({ i }) => i));
  const ignoredRows = indexedUngrouped.filter(({ i }) => {
    if (newRowIdxSet.has(i)) return false;
    return matchActions[i] === "ignorar";
  });

  // Sistema × Extrato totals (fatura-level, independent of matcher tier)
  // Statement total = net bill value. On a card statement, refunds (receitas)
  // reduce the amount owed, so we subtract them instead of summing absolutes.
  const statementNet = indexed.reduce((s, { r }) => s + signedStatementAmount(r), 0);
  const statementTotal = Math.abs(statementNet);
  const statementGrossTotal = indexed.reduce((s, { r }) => s + Math.abs(r.amount), 0);
  const statementCreditsTotal = indexed.reduce(
    (s, { r }) => s + (r.type === "receita" ? Math.abs(r.amount) : 0),
    0,
  );
  const groupedSystemTotal = sumAmounts(
    [...groupedSystemIds].map((id) => groupCandidatesById.get(id)?.amount ?? 0),
  );
  const matchedSystemTotal = [...matchedExactRows, ...matchedToleranceRows].reduce(
    (s, { i }) => s + Math.abs(Number(matches[i]!.best!.candidate.amount)),
    0
  );
  const orphansTotal = orphans.reduce((s, o) => s + Math.abs(o.amount), 0);
  const systemTotal = isCardMode && systemBill ? Math.abs(systemBill.total) : matchedSystemTotal + groupedSystemTotal;
  const systemCount = isCardMode && systemBill ? systemBill.count : matchedExactRows.length + matchedToleranceRows.length + manualLinkedRows.length + groupedSystemIds.size;
  const totalsDelta = statementTotal - systemTotal;
  const totalsDivergent = Math.abs(totalsDelta) > 0.05;
  const coverageMatched =
    matchedExactRows.length +
    matchedToleranceRows.length +
    manualLinkedRows.length +
    indexed.filter(({ i }) => groupedRowIdx.has(i)).length;
  const coverageTotal = indexed.length;
  const onlyStatementRows = newRows; // linhas presentes só no extrato
  const remainingOrphans = orphans.filter(
    (o) => !linkedOrphans.has(o.id) && !groupedSystemIds.has(String(o.id)),
  );

  // Progresso da conciliação (linhas do extrato):
  // - Original = soma de todas as linhas selecionadas do extrato
  // - Conciliado = soma das linhas com ação "vincular" (exact + tolerance + "É o mesmo")
  // - Restante = original − conciliado (o que ainda precisa virar novo/ignorado)
  const reconciledRowsTotal =
    indexedUngrouped
      .filter(({ i }) => (actionOf(i)) === "vincular")
      .reduce((s, { r }) => s + signedStatementAmount(r), 0) +
    indexed
      .filter(({ i }) => groupedRowIdx.has(i))
      .reduce((s, { r }) => s + signedStatementAmount(r), 0);
  const reconciledRowsCount =
    indexedUngrouped.filter(({ i }) => (actionOf(i)) === "vincular").length +
    indexed.filter(({ i }) => groupedRowIdx.has(i)).length;
  const remainingTotal = Math.max(0, statementTotal - Math.abs(reconciledRowsTotal));
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

  // Hierarchical category helpers — resolve by ID to survive name collisions
  // between branches (e.g., "Alimentação" existing as a root and as a leaf under
  // another parent). Without this, `find(c => c.name === parentName)` would
  // silently return the wrong record and hide entire subtrees.
  const categoryIndex = useMemo(() => buildCategoryIndex(categories), [categories]);
  const rootCats = useMemo(
    () => childrenOfId(categoryIndex, null),
    [categoryIndex],
  );
  const childrenOfChain = (
    category: string | undefined,
    subcategory?: string | undefined,
  ) => {
    if (!category) return [];
    const ids = resolveChain({ category, subcategory }, categoryIndex);
    const parentId = subcategory ? ids.subId : ids.rootId;
    if (!parentId) return [];
    return childrenOfId(categoryIndex, parentId);
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
                onClick={() => handleMarkSame(i, cand.id)}
              >
                <Link2 className="h-3 w-3" /> É o mesmo
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              Confirma que a linha do extrato e o lançamento do sistema são a mesma compra. Marca como conciliada — nada é criado nem excluído.
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

          {/* "É outra compra — criar" só faz sentido quando o vínculo pode ser
              falso — ou seja, valor com diferença de centavos (tier=tolerance)
              ou nome divergente (best.suggested). No match exato de mesmo valor
              e mesma descrição não expomos esse botão para evitar duplicatas
              acidentais — nesse caso o botão certo é "Manter só o do extrato". */}
          {(best.tier === "tolerance" || best.suggested) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onActionChange(i, "criar");
                    setExpandedRowId(i);
                  }}
                >
                  <X className="h-3 w-3" /> É outra compra — criar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Desfaz o vínculo, abre a revisão para <strong>renomear e categorizar</strong>, e move a linha para <strong>"Só no extrato"</strong>. O lançamento do sistema continua existindo — pode gerar duplicata proposital.
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

        </div>

      </div>
    );
  };

  const renderManualLinkRow = ({ r, i }: { r: ParsedRow; i: number }) => {
    const targetId = matchTargets[i];
    const orphan = targetId ? orphansById.get(targetId) : undefined;
    const cand = matches[i]?.best?.candidate;
    // Support both: orphan link ("Só no sistema") and suggested-confirmed
    // (row from "Provável" where the target is an existing matched candidate).
    const target = orphan
      ? {
          id: orphan.id,
          description: orphan.description || "(sem descrição)",
          amount: Number(orphan.amount),
          competence_date: orphan.competence_date,
          payment_date: orphan.payment_date,
          status: orphan.status,
          category: orphan.category,
          subcategory: orphan.subcategory,
          subcategory2: orphan.subcategory2,
        }
      : cand
        ? {
            id: cand.id,
            description: cand.description || "(sem descrição)",
            amount: Number(cand.amount),
            competence_date: cand.competence_date || cand.payment_date,
            payment_date: cand.payment_date,
            status: cand.status,
            category: (cand as any).category,
            subcategory: (cand as any).subcategory,
            subcategory2: (cand as any).subcategory2,
          }
        : null;
    if (!target) return null;
    const undo = () => {
      onActionChange(i, "criar");
      onTargetChange(i, null as any);
      if (targetId) {
        setLinkedOrphans((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
      setDismissedSuggestions((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    };
    return (
      <div key={i} className="grid grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)_auto] gap-4 items-start p-3 hover:bg-accent/30">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Extrato</p>
          <p className="font-medium text-sm break-words leading-snug" title={r.description}>{r.description}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · <span className="font-mono">{fmt(r.amount)}</span></p>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <Link2 className="h-4 w-4 text-sky-600" />
          <Badge className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-sky-600 hover:bg-sky-700 text-white border-0">
            manual
          </Badge>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
            EVA
            <Badge variant={target.status === "Pago" ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-3.5">
              {target.status}
            </Badge>
          </p>
          <p className="font-medium text-sm break-words leading-snug" title={target.description}>{target.description}</p>
          <p className="text-xs text-muted-foreground">
            <span title="Data da compra (competência)">Compra {fmtDate(target.competence_date)}</span>
            {target.payment_date && target.payment_date !== target.competence_date && (
              <span className="opacity-60"> · Pgto {fmtDate(target.payment_date)}</span>
            )}
            {" · "}<span className="font-mono">{fmt(Math.abs(target.amount))}</span>
          </p>
          <CategoryChain
            category={resolveCategoryLabel(target.category)}
            subcategory={resolveCategoryLabel(target.subcategory)}
            subcategory2={resolveCategoryLabel(target.subcategory2)}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={undo}
            title="Desfazer o vínculo manual"
          >
            <X className="h-3 w-3" /> Desfazer
          </Button>
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
                  {statementCreditsTotal > 0 && (
                    <p className="text-[10px] text-emerald-700">
                      bruto {fmt(statementGrossTotal)} · créditos − {fmt(statementCreditsTotal)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700">Já conciliado</p>
                  <p className="font-mono text-sm text-emerald-700">− {fmt(Math.abs(reconciledRowsTotal))}</p>
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
                  style={{ width: `${statementTotal > 0 ? Math.min(100, (Math.abs(reconciledRowsTotal) / statementTotal) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Sistema × Extrato — fatura-level summary compacta (card mode) */}
          {isCardMode && (
            <div
              className={`rounded-md border px-3 py-2 flex items-center gap-3 flex-wrap text-xs ${
                totalsDivergent
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm shrink-0">
                {totalsDivergent ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
                Sistema × Extrato
              </div>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                <span>
                  <span className="text-muted-foreground">Sistema:</span>{" "}
                  <span className="font-mono font-medium">
                    {systemBill?.loading ? "…" : fmt(-systemTotal)}
                  </span>
                  <span className="text-muted-foreground/70"> ({systemCount})</span>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  <span className="text-muted-foreground">Extrato:</span>{" "}
                  <span className="font-mono font-medium">{fmt(statementTotal)}</span>
                  <span className="text-muted-foreground/70"> ({indexed.length})</span>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  <span className="text-muted-foreground">Diferença:</span>{" "}
                  <span className={`font-mono font-medium ${totalsDivergent ? "text-amber-700" : "text-emerald-700"}`}>
                    {totalsDelta >= 0 ? "+" : ""}
                    {fmt(totalsDelta)}
                  </span>
                </span>
                {totalsDivergent && (onlyStatementRows.length > 0 || orphans.length > 0) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:underline"
                        title="Ver prováveis causas da divergência"
                      >
                        <Info className="h-3 w-3" /> causas
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 text-xs space-y-1">
                      <p className="font-medium">Prováveis causas da divergência:</p>
                      {onlyStatementRows.length > 0 && (
                        <p>• {onlyStatementRows.length} linha{onlyStatementRows.length === 1 ? "" : "s"} só no extrato ({fmt(Math.abs(onlyStatementRows.reduce((s, { r }) => s + signedStatementAmount(r), 0)))})</p>
                      )}
                      {orphans.length > 0 && (
                        <p>• {orphans.length} lançamento{orphans.length === 1 ? "" : "s"} só no sistema ({fmt(orphansTotal)})</p>
                      )}
                      {statementCreditsTotal > 0 && (
                        <p className="text-emerald-700">• créditos/restituições no extrato: −{fmt(statementCreditsTotal)}</p>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {coverageMatched}/{coverageTotal} conciliadas
              </span>
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

          {/* VINCULADAS MANUALMENTE — vínculos manuais fora da seção "Só no sistema" */}
          {manualLinkedRows.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-sky-700">
                  <Link2 className="h-4 w-4" />
                  Vinculadas manualmente
                  <Badge variant="secondary" className="text-[10px]">{manualLinkedRows.length}</Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">— confirmado pelo usuário via "É o mesmo"</span>
                </h3>
              </header>
              <div className="border border-sky-500/30 rounded-lg overflow-hidden divide-y bg-sky-500/[0.03]">
                {manualLinkedRows.map(renderManualLinkRow)}
              </div>
            </section>
          )}


          {/* AGRUPADAS — conciliação em lote 1↔N (Fase 3) */}
          {groupLeaders.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
                  <Layers className="h-4 w-4" />
                  Agrupadas
                  <Badge variant="secondary" className="text-[10px]">{groupLeaders.length}</Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    — uma linha do extrato conciliada contra vários lançamentos (ou o inverso)
                  </span>
                </h3>
              </header>
              <div className="border border-indigo-500/30 rounded-lg overflow-hidden divide-y bg-indigo-500/[0.03]">
                {groupLeaders.map((leaderIdx) => {
                  const g = groups[leaderIdx];
                  const leaderRow = rows[leaderIdx];
                  const memberRows = [leaderIdx, ...g.extraRowIdx].filter((i) => rows[i]);
                  const stTotal = sumAmounts(memberRows.map((i) => rows[i].amount));
                  const sysTxs = g.systemIds
                    .map((id) => groupCandidatesById.get(String(id)))
                    .filter(Boolean) as CandidateTx[];
                  const sysTotal = sumAmounts(sysTxs.map((c) => Number(c.amount)));
                  return (
                    <div key={leaderIdx} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                            Extrato ({memberRows.length} linha{memberRows.length === 1 ? "" : "s"})
                          </p>
                          {memberRows.map((i) => (
                            <p key={i} className="text-xs break-words leading-snug">
                              <span className="text-muted-foreground">{fmtDate(rows[i].date)}</span>{" "}
                              {rows[i].description}{" "}
                              <span className="font-mono">{fmt(rows[i].amount)}</span>
                            </p>
                          ))}
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                            Sistema ({sysTxs.length})
                          </p>
                          {sysTxs.map((c) => (
                            <p key={c.id} className="text-xs break-words leading-snug">
                              {c.description}{" "}
                              <span className="font-mono">{fmt(Number(c.amount))}</span>
                            </p>
                          ))}
                          {sysTxs.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">lançamentos selecionados</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="text-[10px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                            <Layers className="h-2.5 w-2.5" />
                            Agrupado ({memberRows.length}↔{g.systemIds.length})
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            extrato {fmt(stTotal)} · sistema {fmt(sysTotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px]"
                            onClick={() => setGroupForRow(leaderIdx)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] text-muted-foreground"
                            onClick={() => onGroupUndo?.(leaderIdx)}
                          >
                            Desfazer
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                          onClick={() => handleMarkSame(i, cand.id)}
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
                            setExpandedRowId(i);
                          }}
                          title="Criar como novo lançamento — abre a revisão para renomear e categorizar antes de importar."
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
            {(() => {
              const total = newRows.length;
              const matched = newRows.filter(({ i }) => suggestions[i]?.source === "history").length;
              const unmatched = total - matched;
              const pendingReview = newRows.filter(
                ({ i }) => (actionOf(i)) === "criar" && !(reviewedRows?.has(i))
              ).length;
              return (
                <>
                  <header className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-sky-700">
                      <Sparkles className="h-4 w-4" />
                      Só no extrato — o que fazer?
                      <Badge variant="secondary" className="text-[10px]">{total}</Badge>
                      <GroupMatchDialog
          open={groupForRow !== null}
          onOpenChange={(o) => { if (!o) setGroupForRow(null); }}
          leader={
            groupForRow !== null && rows[groupForRow]
              ? {
                  index: groupForRow,
                  date: rows[groupForRow].date,
                  description: rows[groupForRow].description,
                  amount: rows[groupForRow].amount,
                  type: rows[groupForRow].type,
                }
              : null
          }
          otherRows={availableGroupRows}
          candidates={availableGroupCandidates}
          initial={groupForRow !== null ? groups[groupForRow] : undefined}
          onConfirm={(state) => {
            if (groupForRow === null) return;
            onGroupConfirm?.(groupForRow, state);
            setGroupForRow(null);
          }}
        />

        {suggestLoading && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" /> sugerindo categorias...
                        </span>
                      )}
                    </h3>
                    {total > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                        {pendingReview > 0 && (
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700 bg-amber-500/5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {pendingReview} aguardando revisão
                          </Badge>
                        )}
                        <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 bg-emerald-500/5">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {matched}/{total} do histórico
                        </Badge>
                        {unmatched > 0 && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {unmatched} sem histórico
                          </Badge>
                        )}
                      </div>
                    )}
                  </header>
                </>
              );
            })()}





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
                      
                      <th className="p-2 text-center font-medium w-[220px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRows.map(({ r, i }) => {
                      const sug = suggestions[i];
                      const currentCat = rowCategories[i] || { category: "" };
                      const editedDesc = rowDescriptions[i];
                      const contact = rowContacts[i] || {};
                      const contactName = contact?.supplier_id
                        ? suppliers.find((s) => s.id === contact.supplier_id)?.name
                        : contact?.client_id
                        ? clients.find((c) => c.id === contact.client_id)?.name
                        : undefined;
                      const isReviewed = !!reviewedRows?.has(i);
                      const isReceita = r.type === "receita";
                      const draftDesc = editedDesc ?? r.description;

                      const dupKey = `${r.type}|${Math.abs(r.amount)}|${normalizeText(r.description)}`;
                      const dupCount = duplicateCounts.get(dupKey) || 1;
                      const replacingCandId = matches[i]?.best?.candidate?.id;
                      const isReplacing = !!(
                        replacingCandId && replaceDeleteIds?.has(replacingCandId)
                      );
                      const rowAction = actionOf(i);
                      const willBeCreated = rowAction !== "ignorar";
                      // Categoria é opcional na confirmação: se ficar vazia, a criação
                      // usa "Sem Categoria" como fallback (o usuário classifica depois).
                      // Isso evita que uma linha seja silenciosamente descartada só porque
                      // o toggle "Criar" ficou travado esperando categoria.
                      const canConfirm = draftDesc.trim().length > 0;
                      const missingCategory = !currentCat.category;
                      return (
                        <tr
                          key={i}
                          className={`border-b last:border-0 hover:bg-accent/30 transition-opacity ${
                            isReplacing ? "bg-sky-500/5" : ""
                          } ${isReviewed ? "bg-emerald-500/[0.04]" : ""}`}
                        >
                          <td className="p-2 text-muted-foreground whitespace-nowrap text-xs align-top">{fmtDate(r.date)}</td>
                          <td className="p-2 align-top min-w-[280px]">
                            {isReviewed ? (
                              <>
                                {editedDesc && editedDesc !== r.description ? (
                                  <>
                                    <p className="break-words leading-snug font-medium" title={editedDesc}>{editedDesc}</p>
                                    <p className="text-[10px] text-muted-foreground truncate" title={r.description}>
                                      Original: {r.description}
                                    </p>
                                  </>
                                ) : (
                                  <p className="break-words leading-snug" title={r.description}>{r.description}</p>
                                )}
                                {contactName && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {contact?.supplier_id ? "Fornecedor" : "Cliente"}: <span className="font-medium">{contactName}</span>
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="space-y-1.5">
                                <Input
                                  value={draftDesc}
                                  onChange={(e) => onDescriptionChange?.(i, e.target.value)}
                                  placeholder={r.description}
                                  className={`h-8 text-sm bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input transition-colors ${
                                    draftDesc.trim() === "" ? "border-dashed border-muted-foreground/40" : "border-transparent"
                                  }`}
                                  aria-label="Descrição do lançamento — clique para editar"
                                  title="Clique para editar a descrição"
                                />
                                {editedDesc && editedDesc !== r.description && (
                                  <p className="text-[10px] text-muted-foreground truncate" title={r.description}>
                                    Original: {r.description}
                                  </p>
                                )}
                                <ContactSelectWithCreate
                                  contacts={isReceita ? clients : suppliers}
                                  value={(isReceita ? contact.client_id : contact.supplier_id) || ""}
                                  onChange={(id) =>
                                    onContactChange?.(i, {
                                      supplier_id: !isReceita ? (id || null) : null,
                                      client_id: isReceita ? (id || null) : null,
                                    })
                                  }
                                  type={isReceita ? "client" : "supplier"}
                                  placeholder={isReceita ? "Cliente (opcional)" : "Fornecedor (opcional)"}
                                  onContactCreated={(id, name) => {
                                    onContactChange?.(i, {
                                      supplier_id: !isReceita ? id : null,
                                      client_id: isReceita ? id : null,
                                    });
                                    onContactCreated?.(isReceita ? "client" : "supplier", id, name);
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {duplicateRows?.has(i) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[9px] gap-0.5 cursor-help border-sky-500/50 text-sky-700 bg-sky-500/5">
                                      <Check className="h-2.5 w-2.5" /> Já importado
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-[260px]">
                                    Esta linha já existe no sistema (mesma conta, data, valor e descrição).
                                    Foi ignorada para evitar duplicidade — ative o toggle só se for uma
                                    despesa realmente repetida.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {transferRows?.[i] && !transferDismissed?.has(i) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] gap-0.5 cursor-pointer border-violet-500/50 text-violet-700 bg-violet-500/5"
                                      onClick={() => onTransferDismiss?.(i, true)}
                                    >
                                      <ArrowLeftRight className="h-2.5 w-2.5" /> Transferência interna
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-[260px]">
                                    {transferRows[i]}. Não entra no DRE. Clique no selo para tratar como
                                    receita/despesa normal.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {transferRows?.[i] && transferDismissed?.has(i) && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] gap-0.5 cursor-pointer text-muted-foreground"
                                  onClick={() => onTransferDismiss?.(i, false)}
                                >
                                  Marcar como transferência
                                </Badge>
                              )}
                              {!willBeCreated && (
                                <Badge variant="outline" className="text-[9px] gap-0.5 text-muted-foreground bg-muted/40">
                                  <X className="h-2.5 w-2.5" />
                                  Será ignorado
                                </Badge>
                              )}
                              {willBeCreated && !isReviewed && (
                                <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/50 text-amber-700 bg-amber-500/5">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Rascunho — ative o toggle para criar
                                </Badge>
                              )}
                              <Badge variant={r.type === "receita" ? "default" : "destructive"} className="text-[9px]">
                                {r.type === "receita" ? "Entrada/crédito" : "Saída"}
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
                            <div className={`flex flex-col gap-1 ${isReviewed ? "opacity-70 pointer-events-none" : ""}`}>
                              <CategoryCascadeSelect
                                categories={categories}
                                value={currentCat}
                                type={r.type}
                                onChange={(v) => onCategoryChange(i, v)}
                                onCreateCategory={onCreateCategory}
                              />

                              {sug && !currentCat.touched && currentCat.category === sug.category && (
                                <SuggestionWhyPopover suggestion={sug} rowDescription={r.description} />
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center align-top">
                            <div className="flex flex-col items-center gap-1.5">
                              <div
                                className="inline-flex items-center justify-center gap-2 select-none"
                                title={
                                  isReviewed
                                    ? "Esta linha será criada ao importar. Desligue para ignorar ou editar."
                                    : canConfirm
                                    ? "Ligue para criar esta linha. Desligado = ignorar (não importa)."
                                    : "Preencha a descrição antes de ligar o toggle para criar."
                                }
                              >
                                <span
                                  className={`text-[11px] font-medium whitespace-nowrap ${
                                    isReviewed ? "text-muted-foreground/50" : "text-muted-foreground"
                                  }`}
                                >
                                  Ignorar
                                </span>
                                <NeuToggle
                                  checked={isReviewed}
                                  disabled={!isReviewed && !canConfirm}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      const description = draftDesc.trim() || r.description;
                                      onReviewConfirm?.(i, {
                                        description,
                                        category: { ...currentCat, touched: true },
                                        contact: {
                                          supplier_id: !isReceita ? (contact.supplier_id || null) : null,
                                          client_id: isReceita ? (contact.client_id || null) : null,
                                        },
                                      });
                                      onActionChange(i, "criar");
                                      onExplicitIgnore?.(i, false);
                                    } else {
                                      // Desligar = decisão explícita de ignorar esta linha.
                                      onSetReviewed?.(i, false);
                                      onActionChange(i, "ignorar");
                                      onExplicitIgnore?.(i, true);
                                    }
                                  }}
                                  ariaLabel={isReviewed ? "Desligar para ignorar esta linha" : "Ligar para criar esta linha"}
                                />
                                <span
                                  className={`text-[11px] font-medium whitespace-nowrap ${
                                    isReviewed ? "text-emerald-700" : "text-muted-foreground/50"
                                  }`}
                                >
                                  Criar
                                </span>
                              </div>
                              {isReviewed && (
                                <Badge className="text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                                  <Check className="h-2.5 w-2.5" /> Confirmada
                                </Badge>
                              )}
                              {onGroupConfirm && !isCardMode && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[11px] gap-1 text-indigo-700 hover:bg-indigo-500/10"
                                      onClick={() => setGroupForRow(i)}
                                    >
                                      <Layers className="h-3 w-3" /> Agrupar…
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                                    Concilia esta linha contra <strong>vários</strong> lançamentos do
                                    sistema — ou soma outras linhas do extrato contra um único
                                    lançamento. Nada novo é criado.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
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
          {isCardMode && !orphansLoading && (remainingOrphans.length > 0 || linkedOrphans.size > 0) && (
            <section>
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Só no sistema
                  <Badge variant="secondary" className="text-[10px]">{remainingOrphans.length}</Badge>
                  {linkedOrphans.size > 0 && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
                      {linkedOrphans.size} resolvido{linkedOrphans.size === 1 ? "" : "s"} acima
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    — {remainingOrphans.reduce((s, o) => s + Math.abs(o.amount), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </h3>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowOrphans((v) => !v)}>
                  {showOrphans ? "Ocultar" : "Mostrar"}
                </Button>
              </header>
              {remainingOrphans.length > 0 ? (
                <Alert className="mb-2 py-2 px-3 bg-destructive/5 border-destructive/30">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <AlertDescription className="text-[11px] leading-snug ml-1">
                    Estes valores <strong>não existem no extrato</strong> deste ciclo. Como o extrato vem direto do banco/cartão e é a fonte da verdade, provavelmente são duplicatas, ghosts, lançamentos manuais errados ou pertencem a outra fatura. Revise e exclua os incorretos para a fatura bater.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="mb-2 py-2 px-3 bg-emerald-500/5 border-emerald-500/30">
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <AlertDescription className="text-[11px] leading-snug ml-1 text-emerald-800">
                    Todos os itens desta seção foram resolvidos — veja em <strong>“Vinculadas manualmente”</strong> acima.
                  </AlertDescription>
                </Alert>
              )}

              {showOrphans && (
                remainingOrphans.length > 0 ? (
                  <div className="border border-destructive/30 rounded-lg bg-background max-h-96 overflow-auto divide-y">
                    {remainingOrphans
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
                                            onClick={() => handleMarkSame(i, o.id)}
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
                ) : null
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
                  EVA está cruzando com seu histórico…
                </p>
                <p className="text-xs text-muted-foreground">
                  Buscando categorias já usadas em lançamentos anteriores.
                </p>

              </div>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-primary to-transparent bg-[length:200%_100%] animate-shimmer" />
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


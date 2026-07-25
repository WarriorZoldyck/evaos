import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Loader2, Check, CreditCard, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransactionInsert } from "@/hooks/useTransactions";
import { useImportMatching, type RowMatch } from "@/hooks/useImportMatching";
import { calculateCreditCardBillTotal, filterCreditCardBillScope, descriptionSimilarity, AUTO_LINK_MIN_SIMILARITY, type CandidateTx } from "@/lib/import/matching";
import { getCreditCardDueDate } from "@/lib/creditCardDueDate";
import { ReconcileStep } from "./import/ReconcileStep";
import { ReviewNewEntryModal } from "./import/ReviewNewEntryModal";
import { useCategorySuggestions } from "@/hooks/useCategorySuggestions";
import { CreditCardFormModal } from "@/components/contas/CreditCardFormModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Plus } from "lucide-react";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  selected: boolean;
  series_id?: string;
  installment_number?: number;
  installments_total?: number;
  original_amount?: number;
  base_description?: string;
  detected_card_digits?: string;
  matched_card_id?: string;
  statement_due_date?: string;
  statement_close_date?: string;
  raw_statement_date?: string;
  resolved_competence_date?: string;
  purchase_date_original?: string;
}

const signedStatementAmount = (row: { amount: number; type: "receita" | "despesa" }) =>
  row.type === "receita" ? -Math.abs(row.amount) : Math.abs(row.amount);

interface RowCategoryValue {
  category: string;
  subcategory?: string;
  subcategory2?: string;
  touched?: boolean;
}

/** Normalize a string: lowercase, no accents, single-spaced. */
function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a category name (which can be a leaf at any level) into the full
 * { category, subcategory, subcategory2 } path by walking parent_id upwards.
 */
function resolveCategoryPath(
  name: string,
  categories: { id: string; name: string; parent_id: string | null }[],
): RowCategoryValue {
  if (!name) return { category: "" };
  const norm = normalizeText(name);
  const found = categories.find((c) => c.id === name || normalizeText(c.name) === norm);
  if (!found) return { category: name };
  // Walk up
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: { id: string; name: string; parent_id: string | null }[] = [found];
  let cur = found;
  while (cur.parent_id) {
    const parent = byId.get(cur.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return {
    category: chain[0]?.name || "",
    subcategory: chain[1]?.name,
    subcategory2: chain[2]?.name,
  };
}

function resolveCategoryPathByIds(
  ids: { categoryId?: string; subcategoryId?: string; subcategory2Id?: string },
  categories: { id: string; name: string; parent_id: string | null }[],
): RowCategoryValue | null {
  const deepestId = ids.subcategory2Id || ids.subcategoryId || ids.categoryId;
  if (!deepestId) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const found = byId.get(deepestId);
  if (!found) return null;
  const chain: { id: string; name: string; parent_id: string | null }[] = [found];
  let cur = found;
  while (cur.parent_id) {
    const parent = byId.get(cur.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return {
    category: chain[0]?.name || "",
    subcategory: chain[1]?.name,
    subcategory2: chain[2]?.name,
  };
}

function resolveCategoryName(
  value: string | undefined | null,
  categories: { id: string; name: string }[],
): string | undefined {
  if (!value) return undefined;
  return categories.find((c) => c.id === value)?.name || value;
}


interface ImportStatementModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TransactionInsert[]) => Promise<boolean>;
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: { id: string; name: string; last_four_digits: string | null; parent_card_id?: string | null; bank_account_id?: string; company_id?: string | null; company_name?: string; closing_day?: number | null; due_day?: number | null }[];
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
  allCategories?: { id: string; name: string; parent_id: string | null; type: string | null }[];
  allBankAccounts?: { id: string; name: string; company_id: string | null; company_name?: string }[];
  companies?: { id: string; name: string }[];
  refetchAccounts?: () => Promise<void> | void;
  /** "modal" (default) renders inside a Dialog. "page" renders full-bleed for a dedicated route. */
  variant?: "modal" | "page";
}

/** Detects descriptions that look like a credit-card BILL PAYMENT (not a card purchase). */
function isBillPaymentDescription(desc: string): boolean {
  const d = desc.toLowerCase();
  return /pag(?:t|to|amento|amt)?\.?\s*(?:de\s+)?(?:fatura|cart[ãa]o|credit?o?)/i.test(d) ||
    /fatura\s+cart[ãa]o/i.test(d) ||
    /pgto\s+cart[ãa]o/i.test(d);
}

/** Try to find 4-digit card numbers in a description */
function detectDigitsInDescription(desc: string, cards: { id: string; last_four_digits: string | null; parent_card_id?: string | null }[]): string | undefined {
  // Skip card-match when the line is clearly a bill payment (saída para o cartão),
  // since that belongs to the bank account, not to the card's purchases.
  if (isBillPaymentDescription(desc)) return undefined;
  for (const card of cards) {
    if (!card.last_four_digits) continue;
    if (desc.includes(card.last_four_digits)) return card.id;
  }
  return undefined;
}

/**
 * Resolve year for a raw DD/MM date using the statement's close date.
 * Rule: candidate = raw_date with close_date's year. If candidate > close_date, subtract 1 year.
 * Returns YYYY-MM-DD string.
 */
function resolveRawDateToISO(rawDate: string, closeDateStr: string | undefined, dueDateStr: string | undefined): { competenceDate: string; purchaseDate: string } | null {
  // rawDate can be "DD/MM" or already "YYYY-MM-DD"
  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { competenceDate: rawDate, purchaseDate: rawDate };
  }

  const ddmmMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!ddmmMatch) return null;

  const day = parseInt(ddmmMatch[1]);
  const month = parseInt(ddmmMatch[2]);

  // Determine reference date for year resolution
  const refStr = closeDateStr || dueDateStr;
  if (!refStr) {
    // Fallback: use current year
    const year = new Date().getFullYear();
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { competenceDate: iso, purchaseDate: iso };
  }

  const refDate = new Date(refStr + "T00:00:00");
  const refYear = refDate.getFullYear();

  // Build candidate with reference year
  const candidate = new Date(refYear, month - 1, day);

  // If candidate is after the close/due date, the purchase was from the previous year
  if (candidate > refDate) {
    candidate.setFullYear(refYear - 1);
  }

  const purchaseISO = `${candidate.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // For competence: if close_date exists, use close_date's month as competence
  // (all items in this statement belong to the same billing cycle)
  const competenceISO = closeDateStr || purchaseISO;

  return { competenceDate: competenceISO, purchaseDate: purchaseISO };
}

export function ImportStatementModal({
  open,
  onClose,
  onImport,
  bankAccounts,
  wallets,
  creditCards,
  categories,
  allCategories,
  allBankAccounts,
  companies,
  refetchAccounts,
  variant = "modal",
}: ImportStatementModalProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [targetBankAccount, setTargetBankAccount] = useState("");
  const [importType, setImportType] = useState<"" | "debito" | "cartao">("");
  const [targetCard, setTargetCard] = useState("");
  // Statement total reported by the bank (auto-filled from the parser, user-editable).
  const [statementTotal, setStatementTotal] = useState<number | null>(null);
  const [statementTotalInput, setStatementTotalInput] = useState<string>("");
  const [amountRescaled, setAmountRescaled] = useState<boolean>(false);
  // When divergence > R$ 1,00, user must explicitly acknowledge to import.
  const [acknowledgeDivergence, setAcknowledgeDivergence] = useState(false);

  // Create-new-card flow (nested modal)
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createCardDigits, setCreateCardDigits] = useState<string>("");

  

  // Wizard step
  const [step, setStep] = useState<"preview" | "reconcile" | "summary">("preview");
  // Mês/ano de referência da fatura (YYYY-MM). Fonte da verdade para a busca de
  // lançamentos já existentes no sistema quando o extrato é um cartão de crédito.
  const [billReferenceMonth, setBillReferenceMonth] = useState<string>("");
  const billReferenceMonthTouchedRef = useRef(false);
  const [importResult, setImportResult] = useState<{
    linked: number;
    created: number;
    ignored: number;
    failed: number;
    dateFrom: string;
    dateTo: string;
    status: "Pago" | "Pendente";
  } | null>(null);

  // Per-row reconciliation action: "vincular" | "criar" | "ignorar"
  // Default is "criar" (legacy behavior). "vincular" is suggested when a match exists.
  const [matchActions, setMatchActions] = useState<Record<number, "vincular" | "criar" | "ignorar">>({});
  const [matchTargets, setMatchTargets] = useState<Record<number, string>>({}); // row idx → tx id
  // IDs of system transactions to delete on import (from "Manter só o do extrato").
  const [replaceDeleteIds, setReplaceDeleteIds] = useState<Set<string>>(new Set());
  const { matches, findMatches, loading: matchLoading, reset: resetMatches } = useImportMatching();

  // Orphans = transactions already in the system, in the bill window, that DID NOT match any
  // line of the statement. They are potential errors/duplications: the statement is the source
  // of truth — if it's not there, it shouldn't exist in the system.
  const [orphans, setOrphans] = useState<
    { id: string; description: string; amount: number; competence_date: string; payment_date: string; status: string; category?: string | null; subcategory?: string | null; subcategory2?: string | null }[]
  >([]);
  const [orphansLoading, setOrphansLoading] = useState(false);
  // Pares promovidos pelo passe "extrato = fonte da verdade": órfão do sistema
  // 1↔1 com linha do extrato de mesmo valor. Sobrepõem `matches` sem alterar
  // o hook, e o órfão promovido some da lista "Só no sistema".
  const [extraMatches, setExtraMatches] = useState<Record<number, RowMatch>>({});
  const [promotedOrphanIds, setPromotedOrphanIds] = useState<Set<string>>(new Set());
  const [systemBill, setSystemBill] = useState<{ total: number; count: number; loading: boolean }>({
    total: 0,
    count: 0,
    loading: false,
  });

  // Per-row category override (with 3-level hierarchy). Pre-filled from suggestions when available.
  // `touched: true` means the user manually edited this row — never overwrite via propagation.
  const [rowCategories, setRowCategories] = useState<Record<number, RowCategoryValue>>({});
  // Per-row user-friendly description override (empty = use raw statement description).
  const [rowDescriptions, setRowDescriptions] = useState<Record<number, string>>({});
  // Per-row supplier/client selection.
  const [rowContacts, setRowContacts] = useState<Record<number, { supplier_id?: string | null; client_id?: string | null }>>({});
  // Rows the user has confirmed in the "Revisar novo lançamento" modal.
  const [reviewedRows, setReviewedRows] = useState<Set<number>>(new Set());
  // Which row idx is being reviewed right now (null = modal closed).
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  // Suppliers & clients used to pre-select / render "Fornecedor: X" hints.
  const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);
  const { suggest, suggestions, loading: suggestLoading, reset: resetSuggestions } = useCategorySuggestions();

  // Locally created categories from inside the reconcile step (dedup by id when merging).
  const [extraCategories, setExtraCategories] = useState<{ id: string; name: string; parent_id: string | null; type: string | null }[]>([]);
  const categoryBase = allCategories && allCategories.length > 0 ? allCategories : categories;
  const mergedCategories = useMemo(() => {
    const ids = new Set(categoryBase.map((c) => c.id));
    return [...categoryBase, ...extraCategories.filter((c) => !ids.has(c.id))];
  }, [categoryBase, extraCategories]);
  const rootCategories = mergedCategories.filter((c) => !c.parent_id);



  // Derive detected cards summary (use real card IDs, not collapsed to parent)
  const detectedCards = useMemo(() => {
    const cardIds = new Set(rows.map((r) => r.matched_card_id).filter(Boolean));
    return creditCards.filter((c) => cardIds.has(c.id));
  }, [rows, creditCards]);

  const isMultiCard = detectedCards.length > 1;

  // Per-card summary for display
  const cardSummary = useMemo(() => {
    const summary: Record<string, { count: number; total: number }> = {};
    rows.forEach((r) => {
      if (r.matched_card_id) {
        if (!summary[r.matched_card_id]) summary[r.matched_card_id] = { count: 0, total: 0 };
        summary[r.matched_card_id].count++;
        summary[r.matched_card_id].total += r.amount;
      }
    });
    return summary;
  }, [rows]);
  const isSingleAutoCard = detectedCards.length === 1;

  // Detect digits present in extract that DON'T match any existing card
  const unmatchedDigits = useMemo(() => {
    if (importType !== "cartao") return [] as string[];
    const seen = new Set<string>();
    for (const r of rows) {
      const d = r.detected_card_digits;
      if (!d) continue;
      const matches = creditCards.some((c) => c.last_four_digits === d);
      if (!matches) seen.add(d);
    }
    return Array.from(seen);
  }, [rows, creditCards, importType]);


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setRows([]);

    const lowerName = file.name.toLowerCase();
    const ext = lowerName.match(/\.([a-z0-9]+)$/)?.[1] || "";
    const isBankStatementFile = ["ofx", "qfx", "csv", "txt"].includes(ext);

    try {
      // Preflight: valida sessão antes de subir o PDF
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para importar o extrato.",
          variant: "destructive",
        });
        setParsing(false);
        try { await supabase.auth.signOut(); } catch {}
        window.location.href = "/auth";
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const invokePromise = supabase.functions.invoke('parse-bank-statement', {
        body: formData,
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("O processamento demorou mais de 2 minutos. Tente novamente ou use um arquivo OFX/CSV.") }),
          120_000,
        ),
      );
      const { data: result, error: fnError } = (await Promise.race([invokePromise, timeoutPromise])) as any;

      if (fnError || !result) {
        // Detecta 401 / sessão inválida vindo da edge function
        let status: number | undefined;
        let bodyMsg: string | undefined;
        try {
          status = fnError?.context?.status;
          if (fnError?.context && typeof fnError.context.json === "function") {
            const body = await fnError.context.json();
            bodyMsg = body?.error || body?.message;
          }
        } catch {}
        const rawMsg = `${fnError?.message || ""} ${bodyMsg || ""}`.toLowerCase();
        const isAuthError = status === 401 || /unauthorized|session|jwt/.test(rawMsg);

        if (isAuthError) {
          toast({
            title: "Sessão expirada",
            description: "Faça login novamente para importar o extrato.",
            variant: "destructive",
          });
          setParsing(false);
          try { await supabase.auth.signOut(); } catch {}
          window.location.href = "/auth";
          return;
        }

        toast({
          title: "Erro ao processar arquivo",
          description: bodyMsg || fnError?.message || "Não foi possível processar o arquivo. Tente novamente.",
          variant: "destructive",
        });
        setParsing(false);
        return;
      }




      const raw = (result.transactions || []).map((t: any) => ({
        ...t,
        selected: true,
      }));

      // Detect and group installments by pattern in description
      // Aceita "NN/NN" no final mesmo grudado a letras (ex.: "HOTE02/02").
      const installmentRegex = /(\d{1,2})\s*[\/\\]\s*(\d{1,2})\s*$/;
      const parcRegex = /(?:PARC(?:ELA)?|INST)\s*(\d{1,2})\s*(?:\/|DE|\\)\s*(\d{1,2})/i;

      const groups: Record<string, { indices: number[]; total: number }> = {};

      raw.forEach((t: any, idx: number) => {
        let match = t.description.match(parcRegex) || t.description.match(installmentRegex);
        if (match) {
          const num = parseInt(match[1]);
          const total = parseInt(match[2]);
          if (num > 0 && total > 1 && num <= total) {
            const baseName = t.description
              .replace(installmentRegex, '')
              .replace(parcRegex, '')
              .trim()
              .replace(/[\s\-–]+$/, '');
            const groupKey = `${baseName}__${total}__${t.type}`;
            if (!groups[groupKey]) {
              groups[groupKey] = { indices: [], total };
            }
            groups[groupKey].indices.push(idx);
            raw[idx]._installment_number = num;
            raw[idx]._installments_total = total;
            raw[idx]._base_description = baseName;
            // Propaga sempre — o matcher usa isso p/ discriminar parcelas
            // mesmo quando só uma delas aparece no extrato desta fatura.
            raw[idx].installment_number = num;
            raw[idx].installments_total = total;
            raw[idx].base_description = baseName;
          }
        }
      });

      for (const [, group] of Object.entries(groups)) {
        if (group.indices.length > 1) {
          const sid = crypto.randomUUID();
          const totalAmount = group.indices.reduce((sum, i) => sum + Math.abs(raw[i].amount), 0);
          group.indices.forEach((i) => {
            raw[i].series_id = sid;
            raw[i].original_amount = totalAmount;
          });
        }
      }

      // Per-transaction card detection + date resolution
      const parsed: ParsedTransaction[] = raw.map((t: any) => {
        const { _installment_number, _installments_total, _base_description, ...rest } = t;

        let matchedCardId: string | undefined;
        const looksLikeBillPayment = isBillPaymentDescription(t.description);
        if (t.detected_card_digits && !looksLikeBillPayment) {
          const card = creditCards.find((c) => c.last_four_digits === t.detected_card_digits);
          if (card) matchedCardId = card.id;
        }

        if (!matchedCardId) {
          const descriptionMatch = detectDigitsInDescription(t.description, creditCards);
          if (descriptionMatch) matchedCardId = descriptionMatch;
        }

        // Resolve dates deterministically
        const rawDate = t.raw_statement_date || t.date;
        const resolved = resolveRawDateToISO(rawDate, t.statement_close_date, t.statement_due_date);

        // Ensure date is always a valid YYYY-MM-DD, never DD/MM
        const resolvedPurchaseDate = resolved?.purchaseDate;
        const resolvedCompetenceDate = resolved?.competenceDate;
        const safeDate = resolvedPurchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(resolvedPurchaseDate)
          ? resolvedPurchaseDate
          : (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null);
        const safeCompetence = resolvedCompetenceDate && /^\d{4}-\d{2}-\d{2}$/.test(resolvedCompetenceDate)
          ? resolvedCompetenceDate
          : safeDate;

        // If we still can't resolve, try brute-force from DD/MM with current year
        const finalDate = safeDate || (() => {
          const ddmm = rawDate.match(/^(\d{1,2})\/(\d{1,2})$/);
          if (ddmm) {
            const y = new Date().getFullYear();
            return `${y}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`;
          }
          return new Date().toISOString().slice(0, 10);
        })();

        return {
          ...rest,
          matched_card_id: matchedCardId,
          date: finalDate,
          resolved_competence_date: safeCompetence || finalDate,
          purchase_date_original: finalDate,
          raw_statement_date: t.raw_statement_date || rawDate,
        };
      });

      // NÃO deduplicar o extrato: ele é fonte da verdade.
      // 2 compras iguais no mesmo dia (ex.: 2 sorvetes) são legítimas e precisam
      // aparecer no sistema. Se houver duplicata real de parsing, o usuário
      // desmarca a linha na tela de revisão.
      setRows(parsed);


      // Capture statement total reported by the bank (used to validate the import).
      const parsedStatementTotal = typeof result.statement_total === "number" && result.statement_total > 0
        ? Number(result.statement_total)
        : null;
      setStatementTotal(parsedStatementTotal);
      setStatementTotalInput(
        parsedStatementTotal
          ? parsedStatementTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : ""
      );
      setAmountRescaled(Boolean(result.amount_rescaled));
      setAcknowledgeDivergence(false);

      const detectedCardIds = new Set(parsed.map((r) => r.matched_card_id).filter(Boolean));
      const resolvedDetectedCards = creditCards.filter((c) => detectedCardIds.has(c.id));

      if (detectedCardIds.size >= 1) {
        setImportType("cartao");
        if (detectedCardIds.size === 1) {
          const detectedCard = resolvedDetectedCards[0];
          if (detectedCard) {
            setTargetCard(detectedCard.id);
            // Use the parent's bank_account_id if this is a child card
            const parentCard = detectedCard.parent_card_id
              ? creditCards.find(c => c.id === detectedCard.parent_card_id)
              : detectedCard;
            const bankAccId = parentCard?.bank_account_id || detectedCard.bank_account_id;
            if (bankAccId) {
              setTargetBankAccount(`bank:${bankAccId}`);
            }
          }
        } else {
          // Multi-card: use the first parent's bank account
          const firstCard = resolvedDetectedCards[0];
          const parentCard = firstCard?.parent_card_id
            ? creditCards.find(c => c.id === firstCard.parent_card_id)
            : firstCard;
          const bankAccId = parentCard?.bank_account_id || firstCard?.bank_account_id;
          if (bankAccId) {
            setTargetBankAccount(`bank:${bankAccId}`);
          }
        }
      } else if (isBankStatementFile) {
        // OFX/CSV/TXT without detected cards → assume bank statement (débito em conta)
        setImportType("debito");
      }

      // Auto-select the only available destination account when nothing detected/preset
      const totalDestinations = bankAccounts.length + wallets.length;
      if (totalDestinations === 1) {
        if (bankAccounts.length === 1) {
          setTargetBankAccount((prev) => prev || `bank:${bankAccounts[0].id}`);
        } else if (wallets.length === 1) {
          setTargetBankAccount((prev) => prev || `wallet:${wallets[0].id}`);
        }
      }

      const cardNames = resolvedDetectedCards.map((c) =>
        `${c.name}${c.last_four_digits ? ` (****${c.last_four_digits})` : ""}`
      );

      toast({
        title: `${result.count} transações encontradas`,
        description: cardNames.length > 0
          ? `Cartão(ões) detectado(s): ${cardNames.join(", ")}`
          : (isBankStatementFile
              ? `Extrato bancário detectado — selecione a conta destino e revise antes de importar.`
              : `Revise antes de importar.`),
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }

    setParsing(false);
  };


  // Trigger reconciliation matching for both debit accounts and credit cards
  useEffect(() => {
    if (rows.length === 0) {
      resetMatches();
      return;
    }

    // DEBIT MODE — match against bank account / wallet
    if (importType === "debito") {
      if (!targetBankAccount) {
        resetMatches();
        return;
      }
      const [accType, ...idParts] = targetBankAccount.split(":");
      const accId = idParts.join(":");
      const bankId = accType === "bank" ? accId : null;
      const walletId = accType === "wallet" ? accId : null;

      const lines = rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        type: r.type,
      }));

      findMatches(lines, bankId, walletId, null).then((res) => {
        const nextActions: Record<number, "vincular" | "criar" | "ignorar"> = {};
        const nextTargets: Record<number, string> = {};
        rows.forEach((_, i) => {
          if (res[i]?.best) {
            nextActions[i] = res[i].best!.suggested ? "criar" : "vincular";
            nextTargets[i] = res[i].best!.candidate.id;
          } else {
            nextActions[i] = "criar";
          }
        });
        setMatchActions(nextActions);
        setMatchTargets(nextTargets);
      });
      return;
    }

    // CARD MODE — match against credit_card_id (single or per-row for multi-card)
    if (importType === "cartao") {
      const hasDestination = isMultiCard
        ? rows.some((r) => r.matched_card_id)
        : !!targetCard;
      if (!hasDestination) {
        resetMatches();
        return;
      }

      // Group rows by card id
      const groups = new Map<string, number[]>();
      rows.forEach((r, i) => {
        const cardId = isMultiCard ? r.matched_card_id : targetCard;
        if (!cardId) return;
        const arr = groups.get(cardId) || [];
        arr.push(i);
        groups.set(cardId, arr);
      });

      // Reset matches first; then run each group with merge=true to accumulate
      resetMatches();
      Promise.all(
        Array.from(groups.entries()).map(async ([cardId, indices], groupIdx) => {
          const lines = indices.map((i) => {
            const r = rows[i];
            // For cards we match on the actual purchase date from the statement.
            // resolved_competence_date can be the bill/closing month and must not
            // expand June purchases into July.
            const matchDate = r.purchase_date_original || r.date;
            return {
              date: matchDate,
              description: r.description,
              amount: Math.abs(r.amount),
              type: r.type,
              installment_number: r.installment_number ?? null,
              installments_total: r.installments_total ?? null,
            };
          });
          // First call (groupIdx=0) doesn't merge; subsequent ones do.
          const res = await findMatches(lines, null, null, cardId, { merge: groupIdx > 0 });
          return indices.map((rowIdx, localIdx) => ({ rowIdx, match: res[localIdx] }));
        }),
      ).then((groupResults) => {
        const nextActions: Record<number, "vincular" | "criar" | "ignorar"> = {};
        const nextTargets: Record<number, string> = {};
        rows.forEach((_, i) => {
          nextActions[i] = "criar";
        });
        groupResults.flat().forEach(({ rowIdx, match }) => {
          if (match?.best) {
            // "suggested" = valor+data batem mas nome é diferente — não linka
            // automaticamente, deixa o usuário confirmar com um clique.
            nextActions[rowIdx] = match.best.suggested ? "criar" : "vincular";
            nextTargets[rowIdx] = match.best.candidate.id;
          }
        });
        setMatchActions(nextActions);
        setMatchTargets(nextTargets);
      });
      return;
    }


    resetMatches();
    setExtraMatches({});
    setPromotedOrphanIds(new Set());
  }, [importType, targetBankAccount, targetCard, isMultiCard, rows, findMatches, resetMatches]);

  // O mês da fatura é perguntado ao usuário ANTES do upload (fonte da verdade).
  // Não pré-preenchemos por heurística — assim evitamos casar contra o mês errado
  // quando o parser interpreta datas de forma ambígua.

  // ORPHAN DETECTOR (card mode) — flag system transactions that DON'T appear in the statement.
  // The bank statement is the source of truth: any extra line in the system is a likely error.
  useEffect(() => {
    if (importType !== "cartao" || step !== "reconcile" || rows.length === 0 || matchLoading) {
      if (importType !== "cartao") setSystemBill({ total: 0, count: 0, loading: false });
      return;
    }
    const cardIds = new Set<string>();
    let minDate = "9999-12-31";
    let maxDate = "0000-01-01";
    let billDate = "";
    rows.forEach((r) => {
      if (!r.selected) return;
      const cardId = isMultiCard ? r.matched_card_id : targetCard;
      if (!cardId) return;
      cardIds.add(cardId);
      if (!isMultiCard) {
        creditCards
          .filter((c) => c.parent_card_id === cardId)
          .forEach((child) => cardIds.add(child.id));
      }
      const d = r.purchase_date_original || r.date;
      if (d && d < minDate) minDate = d;
      if (d && d > maxDate) maxDate = d;
      const due = r.statement_due_date || r.resolved_competence_date || r.date;
      if (!billDate && due) billDate = due;
    });
    if (cardIds.size === 0 || minDate > maxDate) {
      setOrphans([]);
      setSystemBill({ total: 0, count: 0, loading: false });
      return;
    }

    const matchedIds = new Set(Object.values(matchTargets).filter(Boolean));
    setOrphansLoading(true);
    setSystemBill((prev) => ({ ...prev, loading: true }));

    // Janela apertada — só o escopo real de compras do extrato.
    const shift = (iso: string, days: number) => {
      const d = new Date(iso + "T00:00:00");
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const wMin = shift(minDate, -3);
    const wMax = shift(maxDate, 3);
    // Prioriza o mês informado pelo usuário (fonte da verdade). Fallback: heurística
    // das próprias linhas do extrato (comportamento legado).
    const billRef = billReferenceMonth
      ? `${billReferenceMonth}-15`
      : (billDate || maxDate);
    const [billYear, billMonth] = billRef.split("-").map(Number);
    const billStart = `${billYear}-${String(billMonth).padStart(2, "0")}-01`;
    const billEndDate = new Date(billYear, billMonth, 0);
    const billEnd = `${billEndDate.getFullYear()}-${String(billEndDate.getMonth() + 1).padStart(2, "0")}-${String(billEndDate.getDate()).padStart(2, "0")}`;

    Promise.all([
      // Fatura real no sistema: mesmo agrupamento da tela de Lançamentos
      (() => {
        let q = supabase
          .from("transactions")
          .select("id, amount, payment_date, type, credit_card_id, payment_method, transfer_id")
          .in("credit_card_id", Array.from(cardIds))
          .gte("payment_date", billStart)
          .lte("payment_date", billEnd)
          .is("transfer_id", null);
        if (isPersonal) q = q.is("company_id", null);
        else if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
        return q.limit(2000);
      })(),
      // Onda A: já vinculadas ao(s) cartão(ões) — sempre listadas
      supabase
        .from("transactions")
        .select("id, description, amount, competence_date, payment_date, purchase_date_original, status, category, subcategory, subcategory2, credit_card_id")
        .in("credit_card_id", Array.from(cardIds))
        .gte("payment_date", billStart)
        .lte("payment_date", billEnd)
        .or(
          `and(purchase_date_original.gte.${wMin},purchase_date_original.lte.${wMax}),and(purchase_date_original.is.null,competence_date.gte.${wMin},competence_date.lte.${wMax})`
        ),
    ]).then(([bill, a]) => {
      setOrphansLoading(false);
      const billRows = filterCreditCardBillScope(
        (bill.data || []).map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          payment_date: t.payment_date,
          type: t.type,
          credit_card_id: t.credit_card_id,
          payment_method: t.payment_method,
          transfer_id: t.transfer_id,
        })),
        Array.from(cardIds),
        billStart,
        billEnd,
      );
      setSystemBill({
        total: calculateCreditCardBillTotal(billRows),
        count: billRows.length,
        loading: false,
      });
      // Onda A: descarta Pago fora do escopo real de compras (fatura anterior)
      const rowsA = (a.data || []).filter((t) => {
        if (t.status !== "Pago") return true;
        const d = t.purchase_date_original || t.competence_date || t.payment_date;
        return d && d >= minDate && d <= maxDate;
      });
      const all = [...rowsA];
      const seen = new Set<string>();
      const orphanList = all
        .filter((t) => !matchedIds.has(t.id))
        .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
        .map((t) => ({
          id: t.id,
          description: t.description || "",
          amount: Number(t.amount),
          competence_date: t.purchase_date_original || t.competence_date || t.payment_date,
          payment_date: t.payment_date,
          status: t.status,
          category: t.category,
          subcategory: t.subcategory,
          subcategory2: t.subcategory2,
        }));
      setOrphans(orphanList);
    }).catch((err) => {
      console.error("[ImportStatement] bill/orphan query error", err);
      setOrphansLoading(false);
      setSystemBill({ total: 0, count: 0, loading: false });
      setOrphans([]);
    });
  }, [importType, step, rows, matchLoading, matchTargets, targetCard, isMultiCard, creditCards, isPersonal, selectedCompanyId, billReferenceMonth]);

  // AUTO-RECONCILIAÇÃO POR VALOR (extrato = fonte da verdade).
  // Se um órfão do sistema (Só no sistema) tem o MESMO valor de UMA ÚNICA linha
  // do extrato ainda sem match e ainda em "criar" (não tocada), promovemos o par
  // como sugestão automática — o extrato veio direto do banco/cartão, então o
  // valor aconteceu; data/descrição divergentes não invalidam o par.
  // Casos ambíguos (>1 candidato do mesmo valor de um lado) permanecem para o
  // usuário resolver com o botão "É o mesmo".
  useEffect(() => {
    if (importType !== "cartao" || step !== "reconcile") return;
    if (orphansLoading || matchLoading) return;
    if (orphans.length === 0 || rows.length === 0) return;

    const unmatchedByCents = new Map<number, number[]>();
    rows.forEach((r, i) => {
      if (!r.selected) return;
      if (matches[i]?.best) return;
      if (extraMatches[i]) return;
      const action = matchActions[i] || "criar";
      if (action !== "criar") return;
      const cents = Math.round(Math.abs(r.amount) * 100);
      const arr = unmatchedByCents.get(cents) || [];
      arr.push(i);
      unmatchedByCents.set(cents, arr);
    });
    if (unmatchedByCents.size === 0) return;

    const orphansByCents = new Map<number, typeof orphans>();
    orphans.forEach((o) => {
      if (promotedOrphanIds.has(o.id)) return;
      const cents = Math.round(Math.abs(o.amount) * 100);
      const arr = orphansByCents.get(cents) || [];
      arr.push(o);
      orphansByCents.set(cents, arr);
    });

    const nextExtra: Record<number, RowMatch> = {};
    const nextActions: Record<number, "vincular"> = {};
    const nextTargets: Record<number, string> = {};
    const promotedIds: string[] = [];

    orphansByCents.forEach((orphList, cents) => {
      const lineIdxs = unmatchedByCents.get(cents) || [];
      if (lineIdxs.length === 0 || orphList.length === 0) return;

      const isSingleton = orphList.length === 1 && lineIdxs.length === 1;

      // Build all (line, orphan) pairs of same value with description similarity.
      const pairs: { idx: number; orph: typeof orphList[number]; sim: number }[] = [];
      for (const idx of lineIdxs) {
        const line = rows[idx];
        for (const orph of orphList) {
          const sim = descriptionSimilarity(line.description || "", orph.description || "");
          pairs.push({ idx, orph, sim });
        }
      }
      // Greedy: prefer strongest description overlap first.
      pairs.sort((a, b) => b.sim - a.sim);

      const usedIdx = new Set<number>();
      const usedOrph = new Set<string>();

      for (const p of pairs) {
        if (usedIdx.has(p.idx) || usedOrph.has(p.orph.id)) continue;
        // 1↔1: preserva comportamento antigo (aceita mesmo sem overlap de texto).
        // M↔N: exige similaridade mínima para não colidir por acaso.
        if (!isSingleton && p.sim < AUTO_LINK_MIN_SIMILARITY) continue;

        const line = rows[p.idx];
        const orph = p.orph;
        const dayDiff = Math.abs(
          Math.round(
            (new Date(line.date + "T00:00:00").getTime() -
              new Date((orph.competence_date || orph.payment_date) + "T00:00:00").getTime()) /
              86400000
          )
        );
        const candidate: CandidateTx = {
          id: orph.id,
          description: orph.description || "",
          amount: Math.abs(orph.amount),
          payment_date: orph.payment_date,
          competence_date: orph.competence_date,
          purchase_date_original: null,
          type: (line.type as "receita" | "despesa") || "despesa",
          status: orph.status,
          category: (orph.category as string | null) ?? null,
          subcategory: (orph.subcategory as string | null) ?? null,
          subcategory2: (orph.subcategory2 as string | null) ?? null,
          contact_name: null,
          series_id: null,
          installment_number: null,
          installments_total: null,
        };
        nextExtra[p.idx] = {
          best: {
            candidate,
            score: 100,
            dayDiff,
            similarity: p.sim,
            amountDiff: 0,
            tier: "exact",
            contactMatched: false,
            suggested: true,
          },
          alternatives: [],
        };
        nextActions[p.idx] = "vincular";
        nextTargets[p.idx] = orph.id;
        promotedIds.push(orph.id);
        usedIdx.add(p.idx);
        usedOrph.add(orph.id);
      }
    });


    if (promotedIds.length === 0) return;

    setExtraMatches((prev) => ({ ...prev, ...nextExtra }));
    setMatchActions((prev) => ({ ...prev, ...nextActions }));
    setMatchTargets((prev) => ({ ...prev, ...nextTargets }));
    setPromotedOrphanIds((prev) => {
      const next = new Set(prev);
      promotedIds.forEach((id) => next.add(id));
      return next;
    });
    setOrphans((prev) => prev.filter((o) => !promotedIds.includes(o.id)));
  }, [importType, step, orphans, orphansLoading, matches, matchLoading, rows, extraMatches, matchActions, promotedOrphanIds]);

  // Matches vistos pelo ReconcileStep = matches do hook + promoções por valor.
  const mergedMatches = useMemo(() => {
    if (Object.keys(extraMatches).length === 0) return matches;
    return { ...matches, ...extraMatches };
  }, [matches, extraMatches]);


  // Trigger history category suggestions once rows + categories are available.
  // Pre-applies suggestion to rowCategories so the user just edits exceptions.
  useEffect(() => {
    if (rows.length === 0 || mergedCategories.length === 0) return;
    if (Object.keys(suggestions).length > 0) return; // only once per file

    const items = rows
      .filter((r) => r.selected)
      .map((r) => ({
        index: rows.indexOf(r),
        description: r.description,
        type: r.type,
        amount: Math.abs(r.amount),
      }));

    suggest(items, mergedCategories).then((res) => {
      // Pre-apply only where user hasn't already set a category. Resolve full path.
      setRowCategories((prev) => {
        const next = { ...prev };
        Object.entries(res).forEach(([k, v]) => {
          const idx = Number(k);
          if (!next[idx] || !next[idx].category) {
            // Prefer explicit hierarchy from the suggestion. Try to rebuild
            // the path from the deepest leaf using the current context tree
            // (walk-up by parent_id). If the leaf isn't in the current tree,
            // fall back to the raw names — never expose UUIDs to the UI.
            const rebuiltByIds = resolveCategoryPathByIds(
              { categoryId: v.categoryId, subcategoryId: v.subcategoryId, subcategory2Id: v.subcategory2Id },
              mergedCategories,
            );
            if (rebuiltByIds?.category) {
              next[idx] = { ...rebuiltByIds, touched: false };
            } else if (v.subcategory || v.subcategory2) {
              const leaf = v.subcategory2 || v.subcategory || v.category;
              const rebuilt = resolveCategoryPath(leaf, mergedCategories);
              const rebuiltIsRealPath =
                !!rebuilt.category && !!mergedCategories.find((c) => c.name === rebuilt.category);
              next[idx] = rebuiltIsRealPath
                ? { ...rebuilt, touched: false }
                : {
                    category: v.category,
                    subcategory: v.subcategory ?? undefined,
                    subcategory2: v.subcategory2 ?? undefined,
                    touched: false,
                  };
            } else {
              next[idx] = { ...resolveCategoryPath(v.category, mergedCategories), touched: false };
            }
          }

        });
        return next;
      });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, mergedCategories.length]);

  // Seed rowCategories from matched candidates: when a statement line matches
  // an existing transaction in the system, inherit its category (highest
  // priority — overrides history/AI suggestions for untouched rows).
  useEffect(() => {
    if (Object.keys(matches).length === 0) return;
    if (mergedCategories.length === 0) return;
    const byId = new Map(mergedCategories.map((c) => [c.id, c] as const));
    const byName = new Map(mergedCategories.map((c) => [c.name, c] as const));
    const toName = (v: string | null | undefined): string | null => {
      if (!v) return null;
      const hit = byId.get(v);
      if (hit) return hit.name;
      if (byName.has(v)) return v;
      return null;
    };
    setRowCategories((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(matches).forEach(([k, m]) => {
        const idx = Number(k);
        const cand = m?.best?.candidate as any;
        const catName = toName(cand?.category);
        if (!catName) return;
        if (next[idx]?.touched) return;
        // Prefer the deepest leaf so resolveCategoryPath rebuilds the 3-level path.
        const leafName =
          toName(cand?.subcategory2) || toName(cand?.subcategory) || catName;
        const resolved = resolveCategoryPath(leafName, mergedCategories);
        const same =
          next[idx]?.category === resolved.category &&
          next[idx]?.subcategory === resolved.subcategory &&
          next[idx]?.subcategory2 === resolved.subcategory2;
        if (same) return;
        next[idx] = { ...resolved, touched: false };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [matches, mergedCategories]);




  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const selectedRows = rows.filter((r) => r.selected);





  const handleImport = async () => {
    if (!user) return;
    if (!targetBankAccount) {
      toast({ title: "Selecione a conta destino", variant: "destructive" });
      return;
    }
    if (!importType) {
      toast({ title: "Selecione o tipo de extrato", variant: "destructive" });
      return;
    }
    // For single-card mode, require card selection
    if (importType === "cartao" && !isMultiCard && !targetCard) {
      toast({ title: "Selecione o cartão de crédito", variant: "destructive" });
      return;
    }

    setImporting(true);

    const [accType, ...idParts] = targetBankAccount.split(":");
    const accId = idParts.join(":");

    // Resolve category name from UUID
    const catName = "Sem Categoria";

    // Find parent card for multi-card fallback
    const parentCardId = isMultiCard
      ? (detectedCards.find(c => !c.parent_card_id)?.id || detectedCards[0]?.id || null)
      : null;

    // Split rows by action — both debit and card now support vincular
    const rowsToCreate: ParsedTransaction[] = [];
    const rowsToLink: { row: ParsedTransaction; txId: string }[] = [];

    selectedRows.forEach((r) => {
      const realIdx = rows.indexOf(r);
      const action = matchActions[realIdx] || "criar";
      if (action === "ignorar") return;
      if (action === "vincular") {
        const txId = matchTargets[realIdx];
        if (txId) {
          rowsToLink.push({ row: r, txId });
        } else {
          console.warn("[ImportStatement] 'vincular' sem matchTarget — caindo em 'criar'", { realIdx, row: r });
          rowsToCreate.push(r);
        }
      } else {
        rowsToCreate.push(r);
      }
    });

    // 1) Link existing transactions — mark Pago (debit) or just reconcile (card / already-Pago)
    let linkOk = 0;
    let linkFail = 0;
    if (rowsToLink.length > 0) {
      await Promise.all(
        rowsToLink.map(async ({ row, txId }) => {
          // Card-mode links keep status as-is (purchases stay projected until bill is paid).
          // Debit-mode promotes Pendente → Pago. Already-Pago stays Pago either way.
          const updatePayload: Record<string, unknown> = {
            is_reconciled: true,
          };
          if (importType === "debito") {
            updatePayload.status = "Pago";
            updatePayload.payment_date = row.date;
          }
          const { error } = await supabase
            .from("transactions")
            .update(updatePayload)
            .eq("id", txId);
          if (error) {
            console.error("[ImportStatement] link error", error);
            linkFail++;
          } else {
            linkOk++;
          }
        })
      );
    }

    // 2) Create new transactions (legacy path)
    const transactions: TransactionInsert[] = rowsToCreate.map((r) => {
      const detectedCard = r.matched_card_id
        ? creditCards.find((c) => c.id === r.matched_card_id)
        : undefined;

      const cardId = isMultiCard
        ? (r.matched_card_id || parentCardId)
        : (importType === "cartao" ? targetCard : null);

      const companyIdForTransaction = importType === "cartao"
        ? (detectedCard?.company_id ?? creditCards.find((c) => c.id === targetCard)?.company_id ?? selectedCompanyId ?? null)
        : (selectedCompanyId || null);

      // For cards, compute the correct bill month PER LINE using the card
      // cycle (closing_day/due_day) applied to the actual purchase date. This
      // avoids dumping every imported line into the same fatura when purchases
      // straddle the closing day.
      let billingDate: string;
      if (importType === "cartao") {
        const cardForLine = cardId ? creditCards.find((c) => c.id === cardId) : undefined;
        // Use parent card cycle when a child card doesn't declare its own.
        const parentForCycle = cardForLine?.parent_card_id
          ? creditCards.find((c) => c.id === cardForLine.parent_card_id)
          : cardForLine;
        const closingDay = cardForLine?.closing_day ?? parentForCycle?.closing_day ?? null;
        const dueDay = cardForLine?.due_day ?? parentForCycle?.due_day ?? null;
        const purchaseISO = r.purchase_date_original || r.date;
        if (closingDay && dueDay && purchaseISO) {
          billingDate = getCreditCardDueDate(purchaseISO, closingDay, dueDay);
        } else {
          billingDate = r.statement_due_date || r.date;
        }
      } else {
        billingDate = r.date;
      }

      const competenceDate = importType === "cartao"
        ? (r.resolved_competence_date || r.statement_close_date || r.statement_due_date || r.date)
        : r.date;

      const purchaseDateOriginal = importType === "cartao" ? (r.purchase_date_original || r.date) : undefined;

      const realIdx = rows.indexOf(r);
      const rowCat = rowCategories[realIdx];
      const categoryName = resolveCategoryName(rowCat?.category, mergedCategories) || catName;
      const subcategoryName = resolveCategoryName(rowCat?.subcategory, mergedCategories) || null;
      const subcategory2Name = resolveCategoryName(rowCat?.subcategory2, mergedCategories) || null;

      return {
        description: r.description,
        amount: r.amount,
        type: r.type,
        payment_date: billingDate,
        competence_date: competenceDate,
        // Cartão de crédito: compras são projetadas (Pendente) até a fatura ser paga.
        // Débito/conta corrente: já saíram da conta, então ficam Pago.
        status: (importType === "cartao" ? "Pendente" : "Pago") as "Pendente" | "Pago",
        category: categoryName,
        subcategory: subcategoryName,
        subcategory2: subcategory2Name,
        user_id: effectiveUserId,
        company_id: companyIdForTransaction,
        bank_account_id: accType === "bank" ? accId : null,
        wallet_id: accType === "wallet" ? accId : null,
        credit_card_id: cardId,
        external_id: `import_${cardId || 'nocrd'}_${billingDate}_${r.date}_${r.amount}_${r.description.replace(/\s+/g, ' ').trim().slice(0, 50)}_${crypto.randomUUID()}`,
        series_id: r.series_id || null,
        installment_number: r.installment_number || null,
        installments_total: r.installments_total || null,
        original_amount: r.original_amount || null,
        purchase_date_original: purchaseDateOriginal || null,
      };

    });

    let createOk = true;
    if (transactions.length > 0) {
      createOk = await onImport(transactions);
    }

    // Delete system transactions the user chose to replace with the statement line.
    let replacedOk = 0;
    if (replaceDeleteIds.size > 0) {
      const ids = Array.from(replaceDeleteIds);
      const { error: delErr } = await supabase.from("transactions").delete().in("id", ids);
      if (delErr) {
        console.error("[ImportStatement] replace-delete error", delErr);
        toast({
          title: "Aviso",
          description: `Não foi possível excluir ${ids.length} lançamento(s) substituído(s): ${delErr.message}`,
          variant: "destructive",
        });
      } else {
        replacedOk = ids.length;
      }
    }

    setImporting(false);

    if (createOk) {
      // Always fire the refresh event when any link/replace occurred — the parent's
      // onImport() only invalidates queries for freshly created rows, so linked
      // (is_reconciled) and replaced rows would otherwise show stale state.
      if (linkOk > 0 || linkFail > 0 || replacedOk > 0) {
        window.dispatchEvent(new Event("transaction-created"));
      }

      // Compute date range across all imported rows for the post-import filter
      const allDates = selectedRows
        .filter((r) => (matchActions[rows.indexOf(r)] || "criar") !== "ignorar")
        .map((r) => r.date)
        .sort();
      const ignoredCount = selectedRows.filter(
        (r) => matchActions[rows.indexOf(r)] === "ignorar"
      ).length;

      // Quando o usuário informou o mês da fatura, o deep-link em Análises EVA
      // respeita o mês/ano informado (primeiro/último dia do mês).
      let dfrom = allDates[0] || "";
      let dto = allDates[allDates.length - 1] || "";
      if (importType === "cartao" && billReferenceMonth) {
        const [by, bm] = billReferenceMonth.split("-").map(Number);
        const end = new Date(by, bm, 0);
        dfrom = `${by}-${String(bm).padStart(2, "0")}-01`;
        dto = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      }
      setImportResult({
        linked: linkOk,
        created: transactions.length,
        ignored: ignoredCount,
        failed: linkFail,
        dateFrom: dfrom,
        dateTo: dto,
        status: importType === "cartao" ? "Pendente" : "Pago",
      });
      setStep("summary");
    }
  };

  const resetAll = () => {
    setRows([]);
    setFileName("");
    setTargetBankAccount("");
    setImportType("");
    setTargetCard("");
    setStatementTotal(null);
    setStatementTotalInput("");
    setAmountRescaled(false);
    setAcknowledgeDivergence(false);
    setMatchActions({});
    setMatchTargets({});
    setReplaceDeleteIds(new Set());
    setOrphans([]);
    setExtraMatches({});
    setPromotedOrphanIds(new Set());
    setSystemBill({ total: 0, count: 0, loading: false });
    setRowCategories({});
    setImportResult(null);
    setStep("preview");
    resetMatches();
    resetSuggestions();
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleViewNew = () => {
    const params = new URLSearchParams();
    params.set("category", "__sem_categoria__");
    if (importResult?.dateFrom) params.set("dateFrom", importResult.dateFrom);
    if (importResult?.dateTo) params.set("dateTo", importResult.dateTo);
    params.set("status", importResult?.status || "Pago");
    handleClose();
    navigate(`/lancamentos?${params.toString()}`);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getCardLabel = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return null;
    return `${card.name}${card.last_four_digits ? ` ****${card.last_four_digits}` : ""}`;
  };

  const isPage = variant === "page";

  const bodyContent = (
    <>
        {isPage ? null : (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Extrato Bancário
              <Badge variant="secondary" className="text-[10px]">Beta</Badge>
            </DialogTitle>
          </DialogHeader>
        )}

        {/* Upload area */}
        {rows.length === 0 && (
          <div className="flex flex-col gap-4 py-6">
            {/* Pergunta o tipo (e o mês, se cartão) ANTES de subir o arquivo,
                para garantir que a busca de "só no sistema" use o mês correto. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo de extrato *</label>
                <Select value={importType} onValueChange={(v) => setImportType(v as "debito" | "cartao")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">💰 Débito em conta</SelectItem>
                    <SelectItem value="cartao">💳 Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {importType === "cartao" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Mês desta fatura *
                  </label>
                  <Input
                    type="month"
                    value={billReferenceMonth}
                    onChange={(e) => {
                      billReferenceMonthTouchedRef.current = true;
                      setBillReferenceMonth(e.target.value);
                    }}
                    placeholder="AAAA-MM"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Usamos esse mês para buscar os lançamentos já registrados desta fatura.
                  </p>
                </div>
              )}
            </div>

            {(() => {
              const canUpload =
                !!importType &&
                (importType !== "cartao" || !!billReferenceMonth);
              const blockedReason = !importType
                ? "Selecione o tipo de extrato para continuar."
                : importType === "cartao" && !billReferenceMonth
                ? "Informe o mês da fatura para continuar."
                : "";
              return (
                <>
                  <div
                    className={
                      "border-2 border-dashed rounded-lg p-8 text-center w-full transition-colors " +
                      (canUpload && !parsing
                        ? "cursor-pointer hover:border-primary/50"
                        : "opacity-60 cursor-not-allowed")
                    }
                    onClick={() => canUpload && !parsing && fileRef.current?.click()}
                  >
                    {parsing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Analisando arquivo com IA…</p>
                        <p className="text-[11px] text-muted-foreground max-w-xs">
                          Pode levar até <strong>40 segundos</strong> em faturas grandes (PDFs com muitas linhas). Não feche esta janela.
                        </p>
                        <div className="w-full max-w-md mt-2 space-y-1.5">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-6 rounded bg-muted/60 animate-pulse"
                              style={{ animationDelay: `${i * 100}ms`, width: `${100 - i * 6}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Clique para selecionar um arquivo</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Formatos aceitos: OFX, CSV, TXT, PDF
                        </p>
                        {blockedReason && (
                          <p className="text-[11px] text-amber-600 mt-2">{blockedReason}</p>
                        )}
                      </>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".ofx,.qfx,.csv,.txt,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              );
            })()}
          </div>
        )}

        {/* Step indicator (when we have rows) */}
        {rows.length > 0 && step !== "summary" && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">1. Conferir</Badge>
            {((importType === "debito" && targetBankAccount) || importType === "cartao") && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant={step === "reconcile" ? "default" : "secondary"} className="text-[10px]">
                  {importType === "cartao" ? "2. Conciliar & Categorizar" : "2. Conciliar"}
                </Badge>
              </>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Importar</Badge>
          </div>
        )}

        {/* PREVIEW STEP */}
        {rows.length > 0 && step === "preview" && (
          <>
            {amountRescaled && (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                <strong>Atenção:</strong> os valores foram ajustados automaticamente porque o leitor de PDF confundiu o separador decimal (interpretou <code>8.850,02</code> como <code>885002</code>). Confira cada linha antes de importar.
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              {/* Account select */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Conta destino *</label>
                <Select value={targetBankAccount} onValueChange={setTargetBankAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={`bank:${a.id}`} value={`bank:${a.id}`}>
                        🏦 {a.name}
                      </SelectItem>
                    ))}
                    {wallets.map((w) => (
                      <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`}>
                        👛 {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Tipo de extrato *</label>
                <Select value={importType} onValueChange={(v) => setImportType(v as "debito" | "cartao")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">💰 Débito em conta</SelectItem>
                    <SelectItem value="cartao">💳 Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              {importType === "cartao" && !isMultiCard && (
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Cartão *</label>
                  <div className="flex gap-2">
                    <Select value={targetCard} onValueChange={setTargetCard}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {creditCards
                          .filter(c => !c.parent_card_id)
                          .map((parent) => {
                            const children = creditCards.filter(c => c.parent_card_id === parent.id);
                            return [
                              <SelectItem key={parent.id} value={parent.id}>
                                💳 {parent.name}{parent.last_four_digits ? ` (****${parent.last_four_digits})` : ""}
                              </SelectItem>,
                              ...children.map(child => (
                                <SelectItem key={child.id} value={child.id} className="pl-8">
                                  ↳ {child.name}{child.last_four_digits ? ` (****${child.last_four_digits})` : ""}
                                </SelectItem>
                              ))
                            ];
                          })}
                        {creditCards
                          .filter(c => c.parent_card_id && !creditCards.some(p => p.id === c.parent_card_id))
                          .map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              💳 {c.name}{c.last_four_digits ? ` (****${c.last_four_digits})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setCreateCardDigits(unmatchedDigits[0] || ""); setCreateCardOpen(true); }}
                      title="Criar novo cartão"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Novo
                    </Button>
                  </div>
                </div>
              )}

              {importType === "cartao" && (
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Qual o mês desta fatura? *
                  </label>
                  <Input
                    type="month"
                    value={billReferenceMonth}
                    onChange={(e) => {
                      billReferenceMonthTouchedRef.current = true;
                      setBillReferenceMonth(e.target.value);
                    }}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Usamos para buscar os lançamentos já registrados neste mês.
                  </p>
                </div>
              )}



            </div>

            {/* Alert when statement mentions a card that user hasn't registered yet */}
            {importType === "cartao" && unmatchedDigits.length > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm">
                    Não encontramos o cartão terminado em <strong>{unmatchedDigits.join(", ")}</strong> nas suas contas. Deseja criá-lo agora?
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setCreateCardDigits(unmatchedDigits[0]); setCreateCardOpen(true); }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Criar cartão
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Auto-detection feedback */}
            {detectedCards.length > 0 && (
              <div className="text-xs font-medium flex flex-col gap-1 text-primary">
                <div className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  {isMultiCard ? (
                    <span>
                      {detectedCards.length} cartões detectados — cada transação será atribuída ao cartão correto
                    </span>
                  ) : (
                    <span>
                      Cartão "{detectedCards[0].name}"{detectedCards[0].last_four_digits ? ` (****${detectedCards[0].last_four_digits})` : ""} detectado automaticamente
                    </span>
                  )}
                </div>
                {isMultiCard && (
                  <div className="flex flex-wrap gap-2 ml-5">
                    {detectedCards.map((c) => {
                      const s = cardSummary[c.id];
                      return (
                        <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 gap-1">
                          {c.name}{c.last_four_digits ? ` ****${c.last_four_digits}` : ""}
                          {s ? ` (${s.count} • ${formatCurrency(s.total)})` : ""}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {fileName} — {selectedRows.length} de {rows.length} selecionadas
            </div>

            {importType === "debito" && targetBankAccount && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {matchLoading ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    Procurando correspondências... <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                ) : (() => {
                  const matched = selectedRows.filter((r) => matches[rows.indexOf(r)]?.best).length;
                  return (
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{matched}</strong> de {selectedRows.length} linhas têm correspondência no EVA — você vai conferir e conciliar na próxima etapa.
                    </span>
                  );
                })()}
              </div>
            )}

            <div className="flex-1 overflow-auto border rounded-lg">
              {importType === "cartao" && rows.some((r) => r.type === "receita") && (
                <div className="m-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700">
                  <p className="font-medium">Entradas/créditos detectados</p>
                  <p className="text-muted-foreground">
                    {rows.filter((r) => r.type === "receita").length} linha{rows.filter((r) => r.type === "receita").length === 1 ? "" : "s"} reduz{rows.filter((r) => r.type === "receita").length === 1 ? "" : "em"} o total da fatura em{" "}
                    <strong>
                      {formatCurrency(rows.filter((r) => r.type === "receita").reduce((sum, r) => sum + Math.abs(r.amount), 0))}
                    </strong>.
                  </p>
                </div>
              )}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={selectedRows.length === rows.length}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </th>
                    <th className="p-2 text-left font-medium">Data Compra</th>
                    {importType === "cartao" && (
                      <th className="p-2 text-left font-medium">Competência</th>
                    )}
                    <th className="p-2 text-left font-medium">Descrição</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                    <th className="p-2 text-center font-medium">Tipo</th>
                    {isMultiCard && (
                      <th className="p-2 text-center font-medium">Cartão</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className={`border-b border-border/50 ${!r.selected ? "opacity-40" : ""}`}>
                      <td className="p-2">
                        <Checkbox checked={r.selected} onCheckedChange={() => toggleRow(idx)} />
                      </td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {r.raw_statement_date || r.date}
                      </td>
                      {importType === "cartao" && (
                        <td className="p-2 text-muted-foreground whitespace-nowrap text-xs">
                          {r.resolved_competence_date || r.date}
                        </td>
                      )}
                      <td className="p-2 max-w-[250px] truncate">
                        {r.description}
                        {r.series_id && (
                          <Badge variant="outline" className="ml-2 text-[9px] px-1">
                            {r.installment_number}/{r.installments_total}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        <span className={r.type === "receita" ? "text-emerald-600" : ""}>
                          {r.type === "receita" ? "− " : ""}{formatCurrency(r.amount)}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant={r.type === "receita" ? "default" : "destructive"} className="text-[10px]">
                          {r.type === "receita" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                      {isMultiCard && (
                        <td className="p-2 text-center">
                          {r.matched_card_id ? (
                            <Badge variant="outline" className="text-[9px] px-1.5">
                              {getCardLabel(r.matched_card_id)}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* RECONCILE STEP */}
        {rows.length > 0 && step === "reconcile" && (() => {
          const [accType, ...idParts] = targetBankAccount.split(":");
          const accId = idParts.join(":");
          const bankId = accType === "bank" ? accId : null;
          const walletId = accType === "wallet" ? accId : null;
          return (
            <ReconcileStep
              mode={importType === "cartao" ? "card" : "debit"}
              rows={rows}
              matches={mergedMatches}
              matchLoading={matchLoading}
              matchActions={matchActions}
              matchTargets={matchTargets}
              onActionChange={(idx, action) =>
                setMatchActions((prev) => ({ ...prev, [idx]: action }))
              }
              onTargetChange={(idx, txId) =>
                setMatchTargets((prev) => ({ ...prev, [idx]: txId }))
              }
              bankAccountId={bankId}
              walletId={walletId}
              replaceDeleteIds={replaceDeleteIds}
              onKeepStatementOnly={(idx) => {
                const cand = mergedMatches[idx]?.best?.candidate;
                if (!cand) return;
                setReplaceDeleteIds((prev) => {
                  const next = new Set(prev);
                  next.add(cand.id);
                  return next;
                });
                // Move row to "criar" so it is imported from the statement.
                setMatchActions((prev) => ({ ...prev, [idx]: "criar" }));
                // Seed category from candidate so the new line inherits classification.
                // Always resolve to NAME (never UUID) — combobox and DB store names.
                setRowCategories((prev) => {
                  if (prev[idx]?.touched) return prev;
                  const catName = resolveCategoryName((cand as any).category, mergedCategories);
                  if (!catName) return prev;
                  return {
                    ...prev,
                    [idx]: {
                      category: catName,
                      subcategory: resolveCategoryName((cand as any).subcategory, mergedCategories),
                      subcategory2: resolveCategoryName((cand as any).subcategory2, mergedCategories),
                      touched: false,
                    },
                  };
                });
              }}
              onUndoKeepStatementOnly={(id) => {
                setReplaceDeleteIds((prev) => {
                  if (!prev.has(id)) return prev;
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              }}
              orphans={orphans}
              orphansLoading={orphansLoading}
              systemBill={systemBill}
              onDeleteOrphan={async (id) => {
                const ok = window.confirm("Excluir este lançamento do sistema? Esta ação não pode ser desfeita.");
                if (!ok) return;
                const { error } = await supabase.from("transactions").delete().eq("id", id);
                if (error) {
                  toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                  return;
                }
                setOrphans((prev) => prev.filter((o) => o.id !== id));
                toast({ title: "Lançamento excluído" });
              }}

              categories={mergedCategories}
              onCreateCategory={async ({ name, parentName, type }) => {
                try {
                  const trimmed = name.trim();
                  if (!trimmed) return null;
                  // Resolve parent by name (root or first-level match) if provided
                  let parent_id: string | null = null;
                  if (parentName) {
                    const p = mergedCategories.find((c) => c.name === parentName);
                    if (p) parent_id = p.id;
                  }
                  const { data, error } = await supabase
                    .from("categories")
                    .insert({
                      name: trimmed,
                      parent_id,
                      type: parent_id ? "ambos" : (type || "ambos"),
                      user_id: effectiveUserId,
                      company_id: selectedCompanyId || null,
                    })
                    .select("id, name, parent_id, type")
                    .single();
                  if (error || !data) {
                    toast({ title: "Erro ao criar categoria", description: error?.message, variant: "destructive" });
                    return null;
                  }
                  // Locally augment the categories list so the new item shows up immediately
                  setExtraCategories((prev) => [...prev, { id: data.id, name: data.name, parent_id: data.parent_id, type: data.type }]);
                  toast({ title: "Categoria criada" });
                  return { id: data.id, name: data.name };
                } catch (e: any) {
                  toast({ title: "Erro ao criar categoria", description: e?.message, variant: "destructive" });
                  return null;
                }
              }}
              rowCategories={rowCategories}
              suggestions={suggestions}
              suggestLoading={suggestLoading}
              onCategoryChange={(idx, value) => {
                // Mark this row as user-touched, then propagate to identical untouched rows.
                setRowCategories((prev) => {
                  const next: Record<number, RowCategoryValue> = { ...prev };
                  next[idx] = { ...value, touched: true };
                  const target = rows[idx];
                  if (target && value.category) {
                    const targetDesc = normalizeText(target.description);
                    let propagated = 0;
                    rows.forEach((r, i) => {
                      if (i === idx) return;
                      if (!r.selected) return;
                      // Propagate by normalized description + type (ignore amount,
                      // since the same merchant may have purchases of different values).
                      if (
                        normalizeText(r.description) === targetDesc &&
                        r.type === target.type
                      ) {
                        const existing = next[i];
                        if (!existing?.touched) {
                          next[i] = { ...value, touched: false };
                          propagated++;
                        }
                      }
                    });
                    if (propagated > 0) {
                      toast({
                        title: `Categoria aplicada a +${propagated} lançamento${propagated > 1 ? "s" : ""} similar${propagated > 1 ? "es" : ""}`,
                        description: "Linhas com a mesma descrição foram categorizadas automaticamente.",
                      });
                    }
                  }

                  return next;
                });
              }}
            />


          );
        })()}

        {/* SUMMARY STEP */}
        {step === "summary" && importResult && (
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Importação concluída</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {importResult.linked > 0 && (
                  <><strong>{importResult.linked}</strong> conciliado{importResult.linked > 1 ? "s" : ""} · </>
                )}
                <strong>{importResult.created}</strong> criado{importResult.created !== 1 ? "s" : ""}
                {importResult.ignored > 0 && (
                  <> · <strong>{importResult.ignored}</strong> ignorado{importResult.ignored > 1 ? "s" : ""}</>
                )}
                {importResult.failed > 0 && (
                  <> · <span className="text-destructive">{importResult.failed} falhou(ram)</span></>
                )}
              </p>
            </div>
            {importResult.created > 0 ? (
              <p className="text-xs text-muted-foreground max-w-md">
                Os lançamentos novos foram criados sem categoria. Que tal categorizá-los agora?
              </p>
            ) : (
              <p className="text-xs text-muted-foreground max-w-md">
                Tudo foi conciliado com lançamentos já existentes — não há novos para categorizar.
              </p>
            )}
          </div>
        )}

        {/* FOOTER — step-aware. On page mode, everything (Voltar, Cancelar, Total, Importar) lives here in a single sticky bottom bar. */}
        {rows.length > 0 && step === "preview" && (() => {
          const canGoReconcile =
            (importType === "debito" && !!targetBankAccount) ||
            (importType === "cartao" && (isMultiCard || !!targetCard) && !!billReferenceMonth);
          return (
            <DialogFooter className={`gap-2 ${isPage ? "sticky bottom-0 z-30 bg-card border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 sm:justify-between items-center" : ""}`}>
              {isPage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  Cancelar importação
                  <span aria-hidden>✕</span>
                </Button>
              ) : (
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
              )}
              {canGoReconcile ? (
                <Button
                  onClick={() => setStep("reconcile")}
                  disabled={selectedRows.length === 0 || matchLoading}
                  className="gap-2"
                >
                  {importType === "cartao" ? "Próximo: Conciliar & Categorizar" : "Próximo: Conciliar"} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleImport}
                  disabled={importing || selectedRows.length === 0 || !targetBankAccount || !importType || (importType === "cartao" && !isMultiCard && !targetCard)}
                  className="gap-2"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Importar {selectedRows.length} transações
                </Button>
              )}
            </DialogFooter>
          );
        })()}


        {rows.length > 0 && step === "reconcile" && (() => {
          const counts = { vincular: 0, criar: 0, ignorar: 0 };
          let netToCreate = 0;
          let netToLink = 0;
          let creditsTotal = 0;
          selectedRows.forEach((r) => {
            const i = rows.indexOf(r);
            const a = matchActions[i] || "criar";
            counts[a]++;
            const signed = signedStatementAmount(r);
            if (r.type === "receita" && a !== "ignorar") creditsTotal += Math.abs(r.amount);
            if (a === "criar") netToCreate += signed;
            if (a === "vincular") netToLink += signed;
          });
          const toImport = counts.vincular + counts.criar;
          const selectedNetTotal = netToCreate + netToLink;
          const fmt = (v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          // Validate vs. statement total reported by the bank.
          const userStatementTotal = (() => {
            const cleaned = statementTotalInput.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
            const n = Number(cleaned);
            return Number.isFinite(n) && n > 0 ? n : null;
          })();
          const selectedNetAbs = Math.abs(selectedNetTotal);
          const diff = userStatementTotal !== null ? +(selectedNetAbs - userStatementTotal).toFixed(2) : null;
          const hasDivergence = diff !== null && Math.abs(diff) > 1.00;
          const blockedByDivergence = hasDivergence && !acknowledgeDivergence;
          const detectedMatches = statementTotal !== null && userStatementTotal !== null &&
            Math.abs(userStatementTotal - statementTotal) < 0.01;

          return (
            <DialogFooter className={`gap-3 ${isPage ? "sticky bottom-0 z-30 bg-card border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 sm:justify-between items-center flex-wrap" : "sm:justify-end flex-col-reverse sm:flex-row items-stretch"}`}>
              {isPage && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("preview")}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                  >
                    Cancelar importação
                    <span aria-hidden>✕</span>
                  </Button>
                </div>
              )}

              {isPage && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    Total informado pelo banco (R$):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 8.850,02"
                    value={statementTotalInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.,]/g, "");
                      setStatementTotalInput(v);
                      setAcknowledgeDivergence(false);
                    }}
                    onBlur={() => {
                      const cleaned = statementTotalInput.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
                      const n = Number(cleaned);
                      if (Number.isFinite(n) && n > 0) {
                        setStatementTotalInput(
                          n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        );
                      }
                    }}
                    className="h-8 w-36 rounded-md border bg-background px-2 text-right text-sm font-mono"
                  />
                  {detectedMatches && (
                    <span className="text-[10px] text-emerald-600 whitespace-nowrap">(detectado)</span>
                  )}
                </div>
              )}

              <div className="flex flex-col items-stretch sm:items-end gap-1.5 min-w-[280px]">
                <span className="text-xs text-muted-foreground text-right">
                  <strong>{counts.vincular}</strong> conciliar · <strong>{counts.criar}</strong> criar · <strong>{counts.ignorar}</strong> ignorar
                </span>
                <span className="text-xs text-muted-foreground text-right">
                  Selecionado líquido:{" "}
                  <strong className="text-foreground">
                    {fmt(selectedNetAbs)}
                  </strong>
                </span>
                {creditsTotal > 0 && (
                  <span className="text-xs text-muted-foreground text-right">
                    Créditos/restituições: <strong className="text-emerald-600">− {fmt(creditsTotal)}</strong>
                  </span>
                )}
                {diff !== null && (
                  <span
                    className={`text-xs text-right ${
                      hasDivergence ? "text-destructive font-medium" : "text-emerald-600"
                    }`}
                  >
                    {hasDivergence ? "⚠ Divergência" : "✓ Bate com a fatura"}:{" "}
                    <strong>{fmt(diff)}</strong>
                    {hasDivergence ? ` (esperado ${fmt(userStatementTotal!)})` : ""}
                  </span>
                )}
                {hasDivergence && (
                  <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-left text-destructive max-w-[360px]">
                    <p className="font-medium mb-1">A importação não bate com o valor da fatura.</p>
                    <p className="text-muted-foreground mb-2">
                      Revise se existem linhas duplicadas no extrato, lançamentos ausentes
                      (IOF internacional, anuidades, cartões adicionais) ou correspondências erradas.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={acknowledgeDivergence}
                        onCheckedChange={(c) => setAcknowledgeDivergence(!!c)}
                        className="mt-0.5"
                      />
                      <span>Entendi a divergência e quero importar mesmo assim.</span>
                    </label>
                  </div>
                )}
                {toImport === 0 ? (
                  <Button
                    onClick={handleClose}
                    className="gap-2 mt-1"
                    title="Todas as linhas foram tratadas como 'manter só o do sistema' ou 'ignorar' — nada precisa ser salvo."
                  >
                    <Check className="h-4 w-4" />
                    Nada a importar — concluir
                  </Button>
                ) : (
                  <Button
                    onClick={handleImport}
                    disabled={importing || blockedByDivergence}
                    className="gap-2 mt-1"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Importar {toImport} ({counts.vincular} conciliar + {counts.criar} criar)
                    {importType === "cartao" ? " para a fatura" : ""}
                  </Button>

                )}
              </div>
            </DialogFooter>
          );
        })()}

        {step === "summary" && importResult && (
          <DialogFooter className={`gap-2 ${isPage ? "sticky bottom-0 z-30 bg-card border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 sm:justify-between items-center" : ""}`}>
            {isPage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("reconcile")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              {importResult.created > 0 && (
                <Button onClick={handleViewNew} className="gap-2">
                  Ver novos para categorizar <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogFooter>
        )}

    </>
  );

  const nestedCreateCard = (
      /* Nested modal: create new credit card from within import */
      <CreditCardFormModal
        open={createCardOpen}
        onClose={() => setCreateCardOpen(false)}
        bankAccounts={(allBankAccounts || bankAccounts.map((a) => ({ id: a.id, name: a.name, company_id: null }))) as any}
        allCreditCards={creditCards.map((c) => ({
          id: c.id,
          name: c.name,
          parent_card_id: c.parent_card_id ?? null,
          closing_day: c.closing_day ?? 1,
          due_day: c.due_day ?? 10,
          bank_account_id: c.bank_account_id ?? "",
        }))}
        defaultValues={{
          name: createCardDigits ? `Cartão ****${createCardDigits}` : "",
          last_four_digits: createCardDigits || undefined,
        }}
        showContextSelector
        companies={companies || []}
        defaultCompanyId={isPersonal ? null : selectedCompanyId}
        onSave={async (data) => {
          if (!effectiveUserId) return false;
          const { error, data: inserted } = await supabase
            .from("credit_cards")
            .insert({
              name: data.name,
              bank_account_id: data.bank_account_id,
              closing_day: data.closing_day,
              due_day: data.due_day,
              limit: data.limit,
              last_four_digits: data.last_four_digits || null,
              parent_card_id: data.parent_card_id || null,
              user_id: effectiveUserId,
              company_id: data.company_id ?? null,
            })
            .select("id")
            .single();
          if (error) {
            toast({ title: "Erro ao criar cartão", description: error.message, variant: "destructive" });
            return false;
          }
          toast({ title: "Cartão criado!", description: "Você já pode usá-lo na importação." });
          if (refetchAccounts) await refetchAccounts();
          if (inserted?.id) setTargetCard(inserted.id);
          return true;
        }}
      />
  );

  if (isPage) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="flex-1">
          {bodyContent}
        </div>
        {nestedCreateCard}
      </div>
    );
  }


  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        {bodyContent}
      </DialogContent>
      {nestedCreateCard}
    </Dialog>
  );
}


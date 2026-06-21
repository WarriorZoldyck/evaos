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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransactionInsert } from "@/hooks/useTransactions";
import { useImportMatching } from "@/hooks/useImportMatching";
import { ReconcileStep } from "./import/ReconcileStep";
import { useCategorySuggestions } from "@/hooks/useCategorySuggestions";

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

interface ImportStatementModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TransactionInsert[]) => Promise<boolean>;
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: { id: string; name: string; last_four_digits: string | null; parent_card_id?: string | null; bank_account_id?: string; company_id?: string | null; company_name?: string }[];
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
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
}: ImportStatementModalProps) {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId } = useCompany();
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
  

  // Wizard step
  const [step, setStep] = useState<"preview" | "reconcile" | "summary">("preview");
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
  const { matches, findMatches, loading: matchLoading, reset: resetMatches } = useImportMatching();

  // Per-row category override (name). Pre-filled from suggestions when available.
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({});
  const { suggest, suggestions, loading: suggestLoading, reset: resetSuggestions } = useCategorySuggestions();

  const rootCategories = categories.filter((c) => !c.parent_id);

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
      const formData = new FormData();
      formData.append("file", file);

      const { data: result, error: fnError } = await supabase.functions.invoke('parse-bank-statement', {
        body: formData,
      });

      if (fnError) {
        toast({
          title: "Erro ao processar arquivo",
          description: "Não foi possível processar o arquivo. Tente novamente.",
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
      const installmentRegex = /[\s\-–](\d{1,2})\s*[\/\\]\s*(\d{1,2})\s*$/;
      const parcRegex = /(?:PARC(?:ELA)?|INST)\s*(\d{1,2})\s*(?:\/|DE|\\)\s*(\d{1,2})/i;
      
      const groups: Record<string, { indices: number[]; total: number }> = {};
      
      raw.forEach((t: any, idx: number) => {
        let match = t.description.match(installmentRegex) || t.description.match(parcRegex);
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
          }
        }
      });

      for (const [, group] of Object.entries(groups)) {
        if (group.indices.length > 1) {
          const sid = crypto.randomUUID();
          const totalAmount = group.indices.reduce((sum, i) => sum + Math.abs(raw[i].amount), 0);
          group.indices.forEach((i) => {
            raw[i].series_id = sid;
            raw[i].installment_number = raw[i]._installment_number;
            raw[i].installments_total = raw[i]._installments_total;
            raw[i].original_amount = totalAmount;
            raw[i].base_description = raw[i]._base_description;
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

      setRows(parsed);

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
            nextActions[i] = "vincular";
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

      Promise.all(
        Array.from(groups.entries()).map(async ([cardId, indices]) => {
          const lines = indices.map((i) => {
            const r = rows[i];
            // For cards, match on the billing/payment date — manual launches use due date
            const matchDate = r.statement_due_date || r.resolved_competence_date || r.date;
            return {
              date: matchDate,
              description: r.description,
              amount: Math.abs(r.amount),
              type: r.type,
            };
          });
          const res = await findMatches(lines, null, null, cardId);
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
            nextActions[rowIdx] = "vincular";
            nextTargets[rowIdx] = match.best.candidate.id;
          }
        });
        setMatchActions(nextActions);
        setMatchTargets(nextTargets);
      });
      return;
    }

    resetMatches();
  }, [importType, targetBankAccount, targetCard, isMultiCard, rows, findMatches, resetMatches]);

  // Trigger AI category suggestions once rows + categories are available.
  // Pre-applies suggestion to rowCategories so the user just edits exceptions.
  useEffect(() => {
    if (rows.length === 0 || categories.length === 0) return;
    if (Object.keys(suggestions).length > 0) return; // only once per file

    const items = rows
      .filter((r) => r.selected)
      .map((r) => ({
        index: rows.indexOf(r),
        description: r.description,
        type: r.type,
        amount: Math.abs(r.amount),
      }));

    suggest(items, categories).then((res) => {
      // Pre-apply only where user hasn't already set a category
      setRowCategories((prev) => {
        const next = { ...prev };
        Object.entries(res).forEach(([k, v]) => {
          const idx = Number(k);
          if (!next[idx]) next[idx] = v.category;
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, categories.length]);


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
      if (action === "vincular" && matchTargets[realIdx]) {
        rowsToLink.push({ row: r, txId: matchTargets[realIdx] });
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

      const billingDate = importType === "cartao"
        ? (r.statement_due_date || r.date)
        : r.date;

      const competenceDate = importType === "cartao"
        ? (r.resolved_competence_date || r.statement_close_date || r.statement_due_date || r.date)
        : r.date;

      const purchaseDateOriginal = importType === "cartao" ? (r.purchase_date_original || r.date) : undefined;

      const realIdx = rows.indexOf(r);
      const rowCat = rowCategories[realIdx] || catName;

      return {
        description: r.description,
        amount: r.amount,
        type: r.type,
        payment_date: billingDate,
        competence_date: competenceDate,
        // Cartão de crédito: compras são projetadas (Pendente) até a fatura ser paga.
        // Débito/conta corrente: já saíram da conta, então ficam Pago.
        status: (importType === "cartao" ? "Pendente" : "Pago") as "Pendente" | "Pago",
        category: rowCat,
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

    setImporting(false);

    if (createOk) {
      // Compute date range across all imported rows for the post-import filter
      const allDates = selectedRows
        .filter((r) => (matchActions[rows.indexOf(r)] || "criar") !== "ignorar")
        .map((r) => r.date)
        .sort();
      const ignoredCount = selectedRows.filter(
        (r) => matchActions[rows.indexOf(r)] === "ignorar"
      ).length;

      setImportResult({
        linked: linkOk,
        created: transactions.length,
        ignored: ignoredCount,
        failed: linkFail,
        dateFrom: allDates[0] || "",
        dateTo: allDates[allDates.length - 1] || "",
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
    
    setMatchActions({});
    setMatchTargets({});
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário
            <Badge variant="secondary" className="text-[10px]">Beta</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Upload area */}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed rounded-lg p-8 text-center w-full cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Clique para selecionar um arquivo</p>
                   <p className="text-xs text-muted-foreground mt-1">
                     Formatos aceitos: OFX, CSV, TXT, PDF
                   </p>
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
                  <Select value={targetCard} onValueChange={setTargetCard}>
                    <SelectTrigger>
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
                </div>
              )}

            </div>

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
                      <td className="p-2 text-right font-mono">{formatCurrency(r.amount)}</td>
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
              matches={matches}
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
              categories={rootCategories}
              rowCategories={rowCategories}
              suggestions={suggestions}
              suggestLoading={suggestLoading}
              onCategoryChange={(idx, name) =>
                setRowCategories((prev) => ({ ...prev, [idx]: name }))
              }
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

        {/* FOOTER — step-aware */}
        {rows.length > 0 && step === "preview" && (() => {
          const canGoReconcile =
            (importType === "debito" && !!targetBankAccount) ||
            (importType === "cartao" && (isMultiCard || !!targetCard));
          return (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
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
          selectedRows.forEach((r) => {
            const i = rows.indexOf(r);
            const a = matchActions[i] || "criar";
            counts[a]++;
          });
          const toImport = counts.vincular + counts.criar;
          return (
            <DialogFooter className="gap-2 sm:justify-between flex-col-reverse sm:flex-row">
              <Button variant="outline" onClick={() => setStep("preview")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {importType === "cartao" ? (
                    <><strong>{counts.criar}</strong> criar · <strong>{counts.ignorar}</strong> ignorar</>
                  ) : (
                    <><strong>{counts.vincular}</strong> conciliar · <strong>{counts.criar}</strong> criar · <strong>{counts.ignorar}</strong> ignorar</>
                  )}
                </span>
                <Button
                  onClick={handleImport}
                  disabled={importing || toImport === 0}
                  className="gap-2"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {importType === "cartao" ? `Importar ${toImport} como projetadas` : "Importar"}
                </Button>
              </div>
            </DialogFooter>
          );
        })()}

        {step === "summary" && importResult && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
            {importResult.created > 0 && (
              <Button onClick={handleViewNew} className="gap-2">
                Ver novos para categorizar <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef, useMemo } from "react";
import { Upload, FileText, Loader2, Check, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

/** Try to find 4-digit card numbers in a description */
function detectDigitsInDescription(desc: string, cards: { id: string; last_four_digits: string | null; parent_card_id?: string | null }[]): string | undefined {
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
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [targetBankAccount, setTargetBankAccount] = useState("");
  const [importType, setImportType] = useState<"" | "debito" | "cartao">("");
  const [targetCard, setTargetCard] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");

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

    try {
      const formData = new FormData();
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-bank-statement`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Erro ao processar arquivo",
          description: result.error || "Erro desconhecido",
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

      // Per-transaction card detection
      const parsed: ParsedTransaction[] = raw.map((t: any) => {
        const { _installment_number, _installments_total, _base_description, ...rest } = t;

        let matchedCardId: string | undefined;
        if (t.detected_card_digits) {
          // Keep the real card ID (child), don't collapse to parent
          const card = creditCards.find((c) => c.last_four_digits === t.detected_card_digits);
          if (card) matchedCardId = card.id;
        }

        if (!matchedCardId) {
          const descriptionMatch = detectDigitsInDescription(t.description, creditCards);
          if (descriptionMatch) matchedCardId = descriptionMatch;
        }

        return { ...rest, matched_card_id: matchedCardId };
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
      }

      const cardNames = resolvedDetectedCards.map((c) =>
        `${c.name}${c.last_four_digits ? ` (****${c.last_four_digits})` : ""}`
      );

      toast({
        title: `${result.count} transações encontradas`,
        description: cardNames.length > 0
          ? `Cartão(ões) detectado(s): ${cardNames.join(", ")}`
          : `Revise antes de importar.`,
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
    const catName = rootCategories.find(c => c.id === defaultCategory)?.name || "Sem Categoria";

    // Find parent card for multi-card fallback
    const parentCardId = isMultiCard
      ? (detectedCards.find(c => !c.parent_card_id)?.id || detectedCards[0]?.id || null)
      : null;

    const transactions: TransactionInsert[] = selectedRows.map((r) => {
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

      return {
        description: r.description,
        amount: r.amount,
        type: r.type,
        payment_date: billingDate,
        competence_date: r.date,
        status: "Pago" as const,
        category: catName,
        user_id: user.id,
        company_id: companyIdForTransaction,
        bank_account_id: accType === "bank" ? accId : null,
        wallet_id: accType === "wallet" ? accId : null,
        credit_card_id: cardId,
        external_id: `import_${cardId || 'nocrd'}_${billingDate}_${r.date}_${r.amount}_${r.description.replace(/\s+/g, ' ').trim().slice(0, 50)}_${crypto.randomUUID()}`,
        series_id: r.series_id || null,
        installment_number: r.installment_number || null,
        installments_total: r.installments_total || null,
        original_amount: r.original_amount || null,
      };
    });

    const success = await onImport(transactions);
    setImporting(false);

    if (success) {
      setRows([]);
      setFileName("");
      onClose();
    }
  };

  const handleClose = () => {
    setRows([]);
    setFileName("");
    setTargetBankAccount("");
    setImportType("");
    setTargetCard("");
    setDefaultCategory("");
    onClose();
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

        {/* Preview */}
        {rows.length > 0 && (
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

              {targetBankAccount && (
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
              )}

              {importType === "cartao" && !isMultiCard && (
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Cartão *</label>
                  <Select value={targetCard} onValueChange={setTargetCard}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Parent cards first, then children grouped under them */}
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
                      {/* Orphan cards (parent_card_id set but parent not in list) */}
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

              {/* Default category */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Categoria padrão</label>
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {rootCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <th className="p-2 text-left font-medium">Data</th>
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
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{r.date}</td>
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

        {rows.length > 0 && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selectedRows.length === 0 || !targetBankAccount || !importType || (importType === "cartao" && !isMultiCard && !targetCard)}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Importar {selectedRows.length} transações
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

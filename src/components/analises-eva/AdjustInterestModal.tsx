import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Percent, Calendar, User, FileText, Check, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AIPendingTransaction } from "@/hooks/useAIPendingTransactions";

export interface InterestBreakdown {
  principal: number;
  interest: number;
  total: number;
}

export function parseInterestFromItem(item: {
  amount: number;
  original_amount?: number | null;
  notes?: string | null;
}): InterestBreakdown | null {
  if (item.notes) {
    const match = item.notes.match(/\[JUROS:\s*R\$\s*([\d.,]+)\s*\|\s*PRINCIPAL:\s*R\$\s*([\d.,]+)\]/i);
    if (match) {
      const parseVal = (s: string) => {
        const clean = s.trim().replace(/\./g, "").replace(",", ".");
        return Number(clean) || 0;
      };
      const interest = parseVal(match[1]);
      const principal = parseVal(match[2]);
      if (interest > 0) {
        return { principal, interest, total: Number(item.amount) };
      }
    }
  }
  if (item.original_amount != null && Number(item.original_amount) > 0 && Number(item.amount) > Number(item.original_amount)) {
    const principal = Number(item.original_amount);
    const total = Number(item.amount);
    const interest = Math.round((total - principal) * 100) / 100;
    if (interest > 0) {
      return { principal, interest, total };
    }
  }
  return null;
}

interface AdjustInterestModalProps {
  item: AIPendingTransaction | null;
  open: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      amount: number;
      original_amount: number;
      notes: string | null;
    }
  ) => Promise<boolean>;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export function AdjustInterestModal({
  item,
  open,
  onClose,
  onSave,
}: AdjustInterestModalProps) {
  const [principal, setPrincipal] = useState<number>(0);
  const [interest, setInterest] = useState<number>(0);
  const [customNote, setCustomNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    const existing = parseInterestFromItem(item);
    if (existing) {
      setPrincipal(existing.principal);
      setInterest(existing.interest);
    } else {
      const base = item.original_amount ?? item.amount ?? 0;
      setPrincipal(base);
      setInterest(0);
    }

    // Strip [JUROS: ...] from existing notes for editing
    const cleanNotes = (item.notes || "")
      .replace(/\[JUROS:\s*R\$\s*[\d.,]+\s*\|\s*PRINCIPAL:\s*R\$\s*[\d.,]+\]\s*/gi, "")
      .trim();
    setCustomNote(cleanNotes);
    setIsSubmitting(false);
  }, [item, open]);

  if (!item) return null;

  const total = Math.round((principal + interest) * 100) / 100;
  const isReceita = item.type === "receita";

  const applyPercent = (pct: number) => {
    if (principal <= 0) return;
    const calculated = Math.round(principal * (pct / 100) * 100) / 100;
    setInterest(calculated);
  };

  const handleConfirm = async () => {
    if (principal <= 0 && total <= 0) return;
    setIsSubmitting(true);

    const fmtNum = (n: number) =>
      n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let finalNotes = customNote.trim();
    if (interest > 0) {
      const tag = `[JUROS: R$ ${fmtNum(interest)} | PRINCIPAL: R$ ${fmtNum(principal)}]`;
      finalNotes = finalNotes ? `${finalNotes}\n${tag}` : tag;
    }

    const success = await onSave(item.id, {
      amount: total,
      original_amount: principal,
      notes: finalNotes || null,
    });

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-amber-500" />
            Editar Valor e Juros por Atraso
          </DialogTitle>
          <DialogDescription>
            Defina o valor principal original e acrescente juros ou encargos caso o pagamento tenha sido realizado em atraso.
          </DialogDescription>
        </DialogHeader>

        {/* Item context summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="font-semibold text-foreground text-sm truncate">{item.description}</p>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            {item.contact_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.contact_name}
              </span>
            )}
            {item.payment_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Venc: {format(parseISO(item.payment_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            <Badge variant={isReceita ? "default" : "destructive"} className="text-[10px] h-4.5 px-1.5">
              {isReceita ? "Receita" : "Despesa"}
            </Badge>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 py-1">
          {/* Valor Principal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Valor Principal (R$) *
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Valor original sem encargos
              </span>
            </div>
            <CurrencyInput
              value={principal}
              onChange={(v) => setPrincipal(v ?? 0)}
              placeholder="0,00"
            />
          </div>

          {/* Juros / Multa */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Juros / Multa por Atraso (R$)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Acréscimo pago além do principal
              </span>
            </div>
            <CurrencyInput
              value={interest}
              onChange={(v) => setInterest(v ?? 0)}
              placeholder="0,00"
            />

            {/* Quick % helpers */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground mr-1">Calcular %:</span>
              {[1, 2, 5, 10].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  onClick={() => applyPercent(pct)}
                >
                  +{pct}%
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setInterest(0)}
              >
                Zerar
              </Button>
            </div>
          </div>

          {/* Real-time breakdown card */}
          <div className="rounded-lg border border-border/80 bg-background/80 p-3 space-y-2 shadow-xs">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Demonstrativo de Valores
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Valor Principal:</span>
                <span className="font-mono font-medium text-foreground">{fmtCurrency(principal)}</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>(+) Juros / Encargos:</span>
                <span className="font-mono font-medium">+{fmtCurrency(interest)}</span>
              </div>
              <div className="border-t border-border pt-1.5 mt-1 flex justify-between items-baseline font-bold text-sm">
                <span>Valor Total Liquidado:</span>
                <span className={`font-mono text-base ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {fmtCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação / Motivo (Opcional)</Label>
            <Textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Ex: Pago com atraso de 5 dias com juros de mora..."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || total <= 0}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            Salvar Valores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addBusinessDays } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Copy, CheckCircle2, Trash2, ExternalLink, ShieldCheck } from "lucide-react";
import type { Transaction, Category, CardTerminalInfo } from "@/hooks/useTransactions";
import { useSignedAttachmentUrl } from "@/hooks/useSignedAttachmentUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const EVA_REVIEW_PREFIX_REGEX = /^⚠️\s*\[(RECUPERAÇÃO|CORREÇÃO)\s+EVA[^\]]*\]\s*/;

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  categories: Category[];
  allCategories?: Category[];
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: { id: string; name: string }[];
  cardTerminals: CardTerminalInfo[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onEdit: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
  onLiquidate: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export function TransactionDetailModal({
  transaction: t,
  onClose,
  categories,
  allCategories,
  bankAccounts,
  wallets,
  creditCards,
  cardTerminals,
  suppliers,
  clients,
  onEdit,
  onDuplicate,
  onLiquidate,
  onDelete,
}: TransactionDetailModalProps) {
  const signedAttachmentUrl = useSignedAttachmentUrl(t?.attachment_url);
  const [marking, setMarking] = useState(false);

  const needsReview = !!t && EVA_REVIEW_PREFIX_REGEX.test(t.description);

  const handleMarkReviewed = async () => {
    if (!t) return;
    const cleaned = t.description.replace(EVA_REVIEW_PREFIX_REGEX, "").trim();
    setMarking(true);
    const { error } = await supabase
      .from("transactions")
      .update({ description: cleaned })
      .eq("id", t.id);
    setMarking(false);
    if (error) {
      toast({ title: "Erro ao marcar como conferido", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lançamento conferido", description: "O aviso de revisão foi removido." });
    window.dispatchEvent(new CustomEvent("transaction-created"));
    onClose();
  };

  if (!t) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Category hierarchy
  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    const found = categories.find((c) => c.id === id || c.name === id);
    if (found) return found.name;
    if (allCategories) {
      const fallback = allCategories.find((c) => c.id === id || c.name === id);
      if (fallback) return fallback.name;
    }
    return null;
  };

  const catParts = [getCategoryName(t.category), getCategoryName(t.subcategory), getCategoryName(t.subcategory2)].filter(Boolean);

  // Account name
  const accountName = t.bank_account_id
    ? bankAccounts.find((a) => a.id === t.bank_account_id)?.name
    : t.wallet_id
    ? wallets.find((w) => w.id === t.wallet_id)?.name
    : t.credit_card_id
    ? creditCards.find((c) => c.id === t.credit_card_id)?.name
    : null;

  // Terminal / MDR
  const terminal = t.card_terminal_id ? cardTerminals.find((ct) => ct.id === t.card_terminal_id) : null;

  let mdrRate = 0;
  let mdrDays = 0;
  if (terminal) {
    const pm = t.payment_method || "";
    if (pm === "Cartão de Débito") {
      mdrRate = terminal.debit_rate || 0;
      mdrDays = terminal.settlement_days_debit || 0;
    } else {
      // Use installment-specific rate from rates_info when available
      const fallbackRate = terminal.credit_rate || 0;
      if (t.installments_total && t.installments_total >= 2 && terminal.rates_info) {
        try {
          const rates = JSON.parse(terminal.rates_info);
          if (Array.isArray(rates)) {
            const match = rates.find((r: { installments: number; rate: number }) => r.installments === t.installments_total);
            mdrRate = match ? match.rate : fallbackRate;
          } else {
            mdrRate = fallbackRate;
          }
        } catch {
          mdrRate = fallbackRate;
        }
      } else {
        mdrRate = fallbackRate;
      }
      mdrDays = terminal.settlement_days_credit || 0;
    }
  }

  const grossAmount = t.original_amount || t.amount;
  const feeAmount = Math.round(grossAmount * (mdrRate / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;
  const settlementDate = mdrDays > 0 ? addBusinessDays(new Date(t.competence_date + "T00:00:00"), mdrDays) : null;

  // Contact
  const supplierName = t.supplier_id ? suppliers.find((s) => s.id === t.supplier_id)?.name : null;
  const clientName = t.client_id ? clients.find((c) => c.id === t.client_id)?.name : null;
  const contactDisplay = supplierName || clientName || t.contact_name;

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) =>
    value ? (
      <div className="flex justify-between items-start py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
      </div>
    ) : null;

  return (
    <Dialog open={!!t} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={t.type === "receita" ? "default" : "destructive"} className="text-xs">
              {t.type === "receita" ? "Receita" : "Despesa"}
            </Badge>
            <Badge variant={t.status === "Pago" ? "default" : "secondary"} className="text-xs">
              {t.status === "Pago" ? "Liquidado" : "Pendente"}
            </Badge>
          </div>
          <DialogTitle className="text-lg mt-2">{t.description}</DialogTitle>
        </DialogHeader>

        {needsReview && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Este lançamento foi <strong>restaurado/corrigido automaticamente pela EVA</strong>. Confira conta, valor e categoria. Quando estiver tudo certo, clique em <strong>Marcar como conferido</strong> para remover este aviso.
          </div>
        )}

        <div className="space-y-1">
          {/* Amount */}
          <div className="text-center py-3">
            <span className={`text-2xl font-bold ${t.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {t.type === "receita" ? "+" : "-"} {formatCurrency(t.amount)}
            </span>
          </div>

          <Separator />

          {/* Dates */}
          <InfoRow label="Data de Pagamento" value={format(new Date(t.payment_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} />
          <InfoRow label="Data de Competência" value={format(new Date(t.competence_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} />
          {(t as any).purchase_date_original && (t as any).purchase_date_original !== t.competence_date && (
            <InfoRow label="Data Original da Compra" value={format(new Date((t as any).purchase_date_original + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} />
          )}

          {/* Category */}
          {catParts.length > 0 && <InfoRow label="Categoria" value={catParts.join(" › ")} />}

          {/* Contact */}
          {contactDisplay && <InfoRow label={t.type === "despesa" ? "Fornecedor" : "Cliente"} value={contactDisplay} />}

          {/* Payment method + account */}
          {t.payment_method && <InfoRow label="Forma de Pagamento" value={t.payment_method} />}
          {accountName && <InfoRow label="Conta" value={accountName} />}

          {/* Installment info */}
          {t.installment_number && t.installments_total && (
            <>
              <Separator className="my-2" />
              <InfoRow label="Parcela" value={`${t.installment_number} de ${t.installments_total}`} />
              {t.original_amount && <InfoRow label="Valor Original da Série" value={formatCurrency(t.original_amount)} />}
            </>
          )}

          {/* MDR info */}
          {terminal && (
            <>
              <Separator className="my-2" />
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Detalhes MDR</h4>
                <InfoRow label="Maquininha" value={`${terminal.name}${terminal.acquirer ? ` (${terminal.acquirer})` : ""}`} />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor bruto</span>
                  <span className="font-medium">{formatCurrency(grossAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-destructive">Taxa MDR ({mdrRate}%)</span>
                  <span className="text-destructive font-medium">-{formatCurrency(feeAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5">
                  <span>Valor líquido</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(netAmount)}</span>
                </div>
                {settlementDate && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                    <span>Recebimento (D+{mdrDays})</span>
                    <span>{format(settlementDate, "dd/MM/yyyy")}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes / Barcode / Attachment */}
          {t.notes && (
            <>
              <Separator className="my-2" />
              <InfoRow label="Observações" value={t.notes} />
            </>
          )}
          {t.liquidation_notes && <InfoRow label="Notas de Liquidação" value={t.liquidation_notes} />}
          {t.barcode && <InfoRow label="Código de Barras" value={t.barcode} />}
          {t.attachment_url && signedAttachmentUrl && (
            <InfoRow
              label="Anexo"
              value={
                <a href={signedAttachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  Ver Anexo <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
          )}
        </div>

        {/* Actions */}
        <Separator className="my-2" />
        <div className="flex flex-wrap gap-2">
          {needsReview && (
            <Button size="sm" onClick={handleMarkReviewed} disabled={marking} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> {marking ? "Marcando..." : "Marcar como conferido"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { onClose(); onEdit(t); }} className="gap-1.5">
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => { onClose(); onDuplicate(t); }} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </Button>
          {t.status === "Pendente" && (
            <Button variant="outline" size="sm" onClick={() => { onClose(); onLiquidate(t); }} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Liquidar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { onClose(); onDelete(t); }} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

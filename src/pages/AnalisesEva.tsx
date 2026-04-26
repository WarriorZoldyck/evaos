import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAIPendingTransactions, AIPendingTransaction } from "@/hooks/useAIPendingTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { useContacts } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TransactionFormModal } from "@/components/lancamentos/TransactionFormModal";
import { useSignedAttachmentUrl } from "@/hooks/useSignedAttachmentUrl";
import type { Transaction, Category as TxCategory } from "@/hooks/useTransactions";
import {
  Sparkles, Check, X, ExternalLink, MessageSquare, Mail, Upload,
  ArrowUpRight, ArrowDownLeft, Calendar, Tag, CreditCard, User,
  FileText, Clock, ChevronDown, ChevronUp, Layers, Pencil, AlertTriangle, Copy,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : "—";
// Helper: convert AIPendingTransaction to Transaction-like object for TransactionFormModal
function pendingToTransaction(item: AIPendingTransaction): Transaction {
  return {
    id: item.id,
    user_id: item.user_id,
    description: item.description,
    amount: item.amount,
    type: item.type as "receita" | "despesa",
    category: item.category || "",
    subcategory: item.subcategory || null,
    subcategory2: item.subcategory2 || null,
    competence_date: item.competence_date || new Date().toISOString().split("T")[0],
    payment_date: item.payment_date || new Date().toISOString().split("T")[0],
    status: (item.transaction_status || "Pago") as "Pago" | "Pendente",
    bank_account_id: item.bank_account_id,
    wallet_id: item.wallet_id,
    credit_card_id: item.credit_card_id,
    card_terminal_id: item.card_terminal_id,
    company_id: item.company_id,
    payment_method: item.payment_method,
    supplier_id: item.supplier_id,
    client_id: item.client_id,
    contact_name: item.contact_name,
    notes: item.notes,
    attachment_url: item.attachment_url,
    barcode: item.barcode,
    installments: item.installments,
    installment_number: item.installment_number,
    installments_total: item.installments_total,
    series_id: item.series_id,
    original_amount: item.original_amount,
    created_at: item.created_at,
    // Fields not present in AIPendingTransaction but required by Transaction type
    external_id: null,
    is_internal_transfer: null,
    is_reconciled: null,
    liquidation_notes: null,
    parent_id: null,
    purchase_date_original: null,
    transfer_id: null,
  };
}
// ── Single item card ──
function PendingCard({
  item, onApprove, onReject, onEdit,
  isApproving, isRejecting, categoryName, accountName, compact = false,
}: {
  item: AIPendingTransaction;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  categoryName: string;
  accountName: string;
  compact?: boolean;
}) {
  const isReceita = item.type === "receita";
  const signedAttachmentUrl = useSignedAttachmentUrl(item.attachment_url);

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/40 text-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-muted-foreground font-medium shrink-0">
            {item.installment_number}/{item.installments_total}
          </span>
          <span className="truncate">{item.description}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.payment_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(item.payment_date)}
            </span>
          )}
          <span className={`font-semibold ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {fmt(item.amount)}
          </span>
        </div>
      </div>
    );
  }

  const sourceIcon = item.source === "whatsapp" ? MessageSquare : item.source === "email" ? Mail : Upload;
  const SourceIcon = sourceIcon;

  return (
    <Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: isReceita ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))" }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1 text-xs">
                <SourceIcon className="h-3 w-3" />
                {item.source === "whatsapp" ? "WhatsApp" : item.source === "email" ? "E-mail" : "Upload"}
              </Badge>
              <Badge variant={isReceita ? "default" : "destructive"} className="gap-1 text-xs">
                {isReceita ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                {isReceita ? "Receita" : "Despesa"}
              </Badge>
              {item.transaction_status === "Pendente" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  Pendente
                </Badge>
              )}
            </div>

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{item.description}</p>
                {item.contact_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" />
                    {item.contact_name}
                  </p>
                )}
              </div>
              <span className={`text-lg font-bold whitespace-nowrap ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {isReceita ? "+" : "-"}{fmt(item.amount)}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDate(item.competence_date)}
              </span>
              {item.payment_date && item.payment_date !== item.competence_date && (
                <span className="flex items-center gap-1 text-primary">
                  <Clock className="h-3 w-3" />
                  Venc: {fmtDate(item.payment_date)}
                </span>
              )}
              {categoryName && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {categoryName}
                </span>
              )}
              {accountName && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {accountName}
                </span>
              )}
              {item.payment_method && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {item.payment_method}
                </span>
              )}
            </div>

            {item.original_message && (
              <p className="text-xs text-muted-foreground/70 italic truncate max-w-md">
                "{item.original_message.replace("[Via WhatsApp] ", "")}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Button size="sm" onClick={onApprove} disabled={isApproving || isRejecting} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={isApproving || isRejecting} className="gap-1.5 text-destructive hover:text-destructive">
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {item.attachment_url && signedAttachmentUrl && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5 ml-auto">
              <a href={signedAttachmentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver anexo
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Series card ──
function SeriesCard({
  items, onApproveAll, onRejectAll, onEditItem,
  isApproving, isRejecting, getCategoryName, getAccountName,
}: {
  items: AIPendingTransaction[];
  onApproveAll: () => void;
  onRejectAll: () => void;
  onEditItem: (item: AIPendingTransaction) => void;
  isApproving: boolean;
  isRejecting: boolean;
  getCategoryName: (id: string | null) => string;
  getAccountName: (item: AIPendingTransaction) => string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...items].sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
  const first = sorted[0];
  const isReceita = first.type === "receita";
  const total = items.reduce((s, i) => s + i.amount, 0);
  const baseDesc = first.description.replace(/\s*\(\d+\/\d+\)\s*$/, "");
  const categoryName = getCategoryName(first.category);
  const accountName = getAccountName(first);

  const sourceIcon = first.source === "whatsapp" ? MessageSquare : first.source === "email" ? Mail : Upload;
  const SourceIcon = sourceIcon;
  const signedAttachmentUrl = useSignedAttachmentUrl(first.attachment_url);

  return (
    <Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: isReceita ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))" }}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 text-xs">
              <SourceIcon className="h-3 w-3" />
              {first.source === "whatsapp" ? "WhatsApp" : first.source === "email" ? "E-mail" : "Upload"}
            </Badge>
            <Badge variant={isReceita ? "default" : "destructive"} className="gap-1 text-xs">
              {isReceita ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {isReceita ? "Receita" : "Despesa"}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Layers className="h-3 w-3" />
              {items.length}x parcelas
            </Badge>
          </div>

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{baseDesc}</p>
              {first.contact_name && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3" />
                  {first.contact_name}
                </p>
              )}
            </div>
            <span className={`text-lg font-bold whitespace-nowrap ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {isReceita ? "+" : "-"}{fmt(total)}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(first.competence_date)}
            </span>
            {categoryName && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {categoryName}
              </span>
            )}
            {accountName && (
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                {accountName}
              </span>
            )}
          </div>

          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-center mt-1">
                {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {open ? "Ocultar parcelas" : "Ver parcelas"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-2">
              {sorted.map((p) => (
                <PendingCard
                  key={p.id}
                  item={p}
                  onApprove={() => {}}
                  onReject={() => {}}
                  isApproving={false}
                  isRejecting={false}
                  categoryName=""
                  accountName=""
                  compact
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Button size="sm" onClick={onApproveAll} disabled={isApproving || isRejecting} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Aprovar Todas
          </Button>
          <Button size="sm" variant="outline" onClick={onRejectAll} disabled={isApproving || isRejecting} className="gap-1.5 text-destructive hover:text-destructive">
            <X className="h-3.5 w-3.5" />
            Rejeitar Todas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEditItem(first)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {first.attachment_url && signedAttachmentUrl && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5 ml-auto">
              <a href={signedAttachmentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver anexo
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Group items ──
type GroupedItem =
  | { kind: "single"; item: AIPendingTransaction }
  | { kind: "series"; seriesId: string; items: AIPendingTransaction[] };

function groupPending(items: AIPendingTransaction[]): GroupedItem[] {
  const seriesMap = new Map<string, AIPendingTransaction[]>();
  const singles: AIPendingTransaction[] = [];

  for (const item of items) {
    if (item.series_id) {
      const list = seriesMap.get(item.series_id) || [];
      list.push(item);
      seriesMap.set(item.series_id, list);
    } else {
      singles.push(item);
    }
  }

  const result: GroupedItem[] = [];
  for (const [seriesId, sItems] of seriesMap) {
    result.push({ kind: "series", seriesId, items: sItems });
  }
  for (const item of singles) {
    result.push({ kind: "single", item });
  }

  result.sort((a, b) => {
    const aDate = a.kind === "single" ? a.item.created_at : a.items[0].created_at;
    const bDate = b.kind === "single" ? b.item.created_at : b.items[0].created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return result;
}

export default function AnalisesEva() {
  const {
    pendingTransactions, reviewedTransactions, duplicateClusters, pendingCount,
    isLoading, approve, reject, approveAll, rejectAll, updatePending,
    keepOne, keepAll, rejectCluster,
    isApproving, isRejecting,
  } = useAIPendingTransactions();

  const { categories } = useCategories();
  const { bankAccounts: accounts, creditCards, wallets, cardTerminals } = useAccounts();
  const { suppliers, clients } = useContacts();
  const { companies } = useCompany();
  const { settings: fieldSettings } = useFormFieldSettings();

  const [editingItem, setEditingItem] = useState<AIPendingTransaction | null>(null);

  // Convert categories to the format TransactionFormModal expects
  const txCategories: TxCategory[] = useMemo(() =>
    categories.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id, type: c.type || null })),
    [categories]
  );

  // Convert cardTerminals to CardTerminalInfo format
  const cardTerminalInfos = useMemo(() =>
    cardTerminals.map((t) => ({
      id: t.id,
      name: t.name,
      acquirer: t.acquirer,
      bank_account_id: t.bank_account_id,
      debit_rate: t.debit_rate,
      credit_rate: t.credit_rate,
      settlement_days_debit: t.settlement_days_debit,
      settlement_days_credit: t.settlement_days_credit,
      rates_info: t.rates_info,
      auto_anticipation: t.auto_anticipation,
    })),
    [cardTerminals]
  );

  // Handler: intercept TransactionFormModal's onUpdate to save to ai_pending_transactions
  const handlePendingUpdate = async (id: string, data: Partial<Transaction>): Promise<boolean> => {
    const updates: Partial<AIPendingTransaction> = {
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category || null,
      subcategory: data.subcategory || null,
      subcategory2: data.subcategory2 || null,
      competence_date: data.competence_date || null,
      payment_date: data.payment_date || null,
      transaction_status: data.status || null,
      bank_account_id: data.bank_account_id || null,
      wallet_id: data.wallet_id || null,
      credit_card_id: data.credit_card_id || null,
      card_terminal_id: data.card_terminal_id || null,
      company_id: data.company_id || null,
      payment_method: data.payment_method || null,
      supplier_id: data.supplier_id || null,
      client_id: data.client_id || null,
      contact_name: data.contact_name || null,
      notes: data.notes || null,
      attachment_url: data.attachment_url || null,
      barcode: data.barcode || null,
    };
    updatePending({ id, updates });
    return true;
  };

  // Dummy handlers (not used for pending edits but required by TransactionFormModal)
  const dummySave = async (): Promise<boolean> => false;
  const dummySaveMultiple = async (): Promise<boolean> => false;

  const editTransaction = useMemo(() =>
    editingItem ? pendingToTransaction(editingItem) : null,
    [editingItem]
  );

  const getCategoryName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat?.name || "";
  };

  const getAccountName = (item: AIPendingTransaction) => {
    if (item.credit_card_id) {
      const cc = creditCards.find((c) => c.id === item.credit_card_id);
      return cc?.name || "";
    }
    if (item.bank_account_id) {
      const acc = accounts.find((a) => a.id === item.bank_account_id);
      return acc?.name || "";
    }
    if (item.wallet_id) {
      const w = wallets.find((wl) => wl.id === item.wallet_id);
      return w?.name || "";
    }
    return "";
  };

  const whatsappPending = pendingTransactions.filter((t) => t.source === "whatsapp");
  const otherPending = pendingTransactions.filter((t) => t.source !== "whatsapp");

  const whatsappGrouped = groupPending(whatsappPending);
  const otherGrouped = groupPending(otherPending);

  const renderGrouped = (grouped: GroupedItem[]) =>
    grouped.map((g) => {
      if (g.kind === "series") {
        return (
          <SeriesCard
            key={g.seriesId}
            items={g.items}
            onApproveAll={() => approveAll(g.items)}
            onRejectAll={() => rejectAll(g.items)}
            onEditItem={(item) => setEditingItem(item)}
            isApproving={isApproving}
            isRejecting={isRejecting}
            getCategoryName={getCategoryName}
            getAccountName={getAccountName}
          />
        );
      }
      return (
        <PendingCard
          key={g.item.id}
          item={g.item}
          onApprove={() => approve(g.item)}
          onReject={() => reject(g.item.id)}
          onEdit={() => setEditingItem(g.item)}
          isApproving={isApproving}
          isRejecting={isRejecting}
          categoryName={getCategoryName(g.item.category)}
          accountName={getAccountName(g.item)}
        />
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Análises EVA</h1>
            <p className="text-sm text-muted-foreground">
              Revise e aprove os lançamentos gerados pela IA
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge className="ml-2 text-sm px-3 py-1">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
            {whatsappPending.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{whatsappPending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outros" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Outros
            {otherPending.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{otherPending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="duplicatas" className="gap-1.5">
            <Copy className="h-4 w-4" />
            Duplicatas
            {duplicateClusters.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{duplicateClusters.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))
          ) : whatsappGrouped.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento do WhatsApp pendente de aprovação.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Envie documentos e comprovantes pelo WhatsApp para a EVA processar.</p>
              </CardContent>
            </Card>
          ) : (
            renderGrouped(whatsappGrouped)
          )}
        </TabsContent>

        <TabsContent value="outros" className="mt-4 space-y-3">
          {otherGrouped.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento de outras fontes pendente.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Em breve: integração com e-mail e upload direto.</p>
              </CardContent>
            </Card>
          ) : (
            renderGrouped(otherGrouped)
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {reviewedTransactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento revisado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            reviewedTransactions.map((item) => (
              <Card key={item.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(item.amount)}
                        {" · "}
                        {item.reviewed_at ? format(parseISO(item.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}
                      </p>
                    </div>
                    <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                      {item.status === "approved" ? "Aprovado" : "Rejeitado"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="duplicatas" className="mt-4 space-y-4">
          {duplicateClusters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Copy className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma duplicata detectada.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Lançamentos com mesmo valor, descrição e data serão agrupados aqui.</p>
              </CardContent>
            </Card>
          ) : (
            duplicateClusters.map((cluster, idx) => {
              const isReceita = cluster[0].type === "receita";
              const isOrphan = cluster.length === 1;

              if (isOrphan) {
                const item = cluster[0];
                return (
                  <Card key={idx} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-sm">Suspeita de duplicata (original já processado)</span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/40 text-sm">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="font-medium truncate">{item.description}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{fmtDate(item.competence_date)}</span>
                            <span>{item.source}</span>
                            {item.contact_name && <span>{item.contact_name}</span>}
                            <span className={`font-semibold ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmt(item.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => keepAll([item.id])}>
                          <Check className="h-3.5 w-3.5" />
                          Manter como Pendente
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => rejectCluster([item.id])}>
                          <X className="h-3.5 w-3.5" />
                          Rejeitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={idx} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-sm">Possível duplicata ({cluster.length} lançamentos)</span>
                    </div>

                    <div className="space-y-2">
                      {cluster.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/40 text-sm">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="font-medium truncate">{item.description}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{fmtDate(item.competence_date)}</span>
                              <span>{item.source}</span>
                              {item.contact_name && <span>{item.contact_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-semibold ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmt(item.amount)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => keepOne({
                                keepId: item.id,
                                rejectIds: cluster.filter((c) => c.id !== item.id).map((c) => c.id),
                              })}
                            >
                              <Check className="h-3 w-3" />
                              Manter
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => keepAll(cluster.map((c) => c.id))}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Manter Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        onClick={() => rejectCluster(cluster.map((c) => c.id))}
                      >
                        <X className="h-3.5 w-3.5" />
                        Rejeitar Todos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <TransactionFormModal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        editTransaction={editTransaction}
        onSave={dummySave}
        onSaveMultiple={dummySaveMultiple}
        onUpdate={handlePendingUpdate}
        bankAccounts={accounts}
        creditCards={creditCards}
        wallets={wallets}
        suppliers={suppliers}
        clients={clients}
        categories={txCategories}
        cardTerminals={cardTerminalInfos}
        companies={companies}
        fieldSettings={fieldSettings}
      />
    </div>
  );
}

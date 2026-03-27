import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAIPendingTransactions, AIPendingTransaction } from "@/hooks/useAIPendingTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Check, X, ExternalLink, MessageSquare, Mail, Upload,
  ArrowUpRight, ArrowDownLeft, Calendar, Tag, CreditCard, User,
  FileText, Clock, ChevronDown, ChevronUp, Layers, Pencil, AlertTriangle, Copy,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : "—";

// ── Edit Modal ──
function EditPendingModal({
  item,
  open,
  onClose,
  onSave,
  categories,
  bankAccounts,
  creditCards,
  wallets,
}: {
  item: AIPendingTransaction | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: { id: string; updates: Partial<AIPendingTransaction> }) => void;
  categories: { id: string; name: string; parent_id: string | null }[];
  bankAccounts: { id: string; name: string }[];
  creditCards: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
}) {
  const [desc, setDesc] = useState(item?.description || "");
  const [amount, setAmount] = useState(String(item?.amount || 0));
  const [type, setType] = useState(item?.type || "despesa");
  const [categoryId, setCategoryId] = useState(item?.category || "");
  const [competenceDate, setCompetenceDate] = useState(item?.competence_date || "");
  const [paymentDate, setPaymentDate] = useState(item?.payment_date || "");
  const [transactionStatus, setTransactionStatus] = useState(item?.transaction_status || "Pago");
  const [contactName, setContactName] = useState(item?.contact_name || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [bankAccountId, setBankAccountId] = useState(item?.bank_account_id || "");
  const [creditCardId, setCreditCardId] = useState(item?.credit_card_id || "");
  const [walletId, setWalletId] = useState(item?.wallet_id || "");
  const [companyId, setCompanyId] = useState(item?.company_id || "");
  const { companies } = useCompany();

  // Reset state when item changes
  const [prevId, setPrevId] = useState<string | null>(null);
  if (item && item.id !== prevId) {
    setPrevId(item.id);
    setDesc(item.description);
    setAmount(String(item.amount));
    setType(item.type);
    setCategoryId(item.category || "");
    setCompetenceDate(item.competence_date || "");
    setPaymentDate(item.payment_date || "");
    setTransactionStatus(item.transaction_status || "Pago");
    setContactName(item.contact_name || "");
    setNotes(item.notes || "");
    setBankAccountId(item.bank_account_id || "");
    setCreditCardId(item.credit_card_id || "");
    setWalletId(item.wallet_id || "");
    setCompanyId(item.company_id || "");
  }

  if (!item) return null;

  const rootCategories = categories.filter((c) => !c.parent_id);

  const handleSave = () => {
    onSave({
      id: item.id,
      updates: {
        description: desc,
        amount: parseFloat(amount) || 0,
        type,
        category: categoryId || null,
        competence_date: competenceDate || null,
        payment_date: paymentDate || null,
        transaction_status: transactionStatus,
        contact_name: contactName || null,
        notes: notes || null,
        bank_account_id: bankAccountId || null,
        credit_card_id: creditCardId || null,
        wallet_id: walletId || null,
        company_id: companyId || null,
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Contexto</Label>
            <Select value={companyId || "pessoal"} onValueChange={(v) => setCompanyId(v === "pessoal" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {rootCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Competência</Label>
              <Input type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} />
            </div>
            <div>
              <Label>Data Pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={transactionStatus} onValueChange={setTransactionStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contato</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <Label>Conta</Label>
            <Select value={bankAccountId || creditCardId || walletId || "none"} onValueChange={(v) => {
              setBankAccountId(""); setCreditCardId(""); setWalletId("");
              if (v === "none") return;
              const [accType, id] = v.split(":");
              if (accType === "bank") setBankAccountId(id);
              else if (accType === "card") setCreditCardId(id);
              else if (accType === "wallet") setWalletId(id);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {bankAccounts.map((a) => (
                  <SelectItem key={`bank:${a.id}`} value={`bank:${a.id}`}>🏦 {a.name}</SelectItem>
                ))}
                {creditCards.map((c) => (
                  <SelectItem key={`card:${c.id}`} value={`card:${c.id}`}>💳 {c.name}</SelectItem>
                ))}
                {wallets.map((w) => (
                  <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`}>👛 {w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
          {item.attachment_url && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5 ml-auto">
              <a href={item.attachment_url} target="_blank" rel="noopener noreferrer">
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
          {first.attachment_url && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5 ml-auto">
              <a href={first.attachment_url} target="_blank" rel="noopener noreferrer">
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
  const { bankAccounts: accounts, creditCards, wallets } = useAccounts();

  const [editingItem, setEditingItem] = useState<AIPendingTransaction | null>(null);

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

      <EditPendingModal
        item={editingItem}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={updatePending}
        categories={categories}
        bankAccounts={accounts}
        creditCards={creditCards}
        wallets={wallets}
      />
    </div>
  );
}

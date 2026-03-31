import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit, Copy, Trash2, CheckCircle2, MoreHorizontal, Loader2,
  Landmark, Wallet, CreditCard, HelpCircle, Eye, Repeat,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Transaction, Category } from "@/hooks/useTransactions";

interface CreditCardWithHierarchy {
  id: string;
  name: string;
  parent_card_id?: string | null;
  last_four_digits?: string | null;
}

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  categories: Category[];
  allCategories?: Category[];
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: CreditCardWithHierarchy[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onLiquidate: (transaction: Transaction) => void;
  onViewDetails: (transaction: Transaction) => void;
}

// ── Helpers ──────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

function useCategoryHelpers(categories: Category[], allCategories?: Category[]) {
  const findCategory = (value: string | null | undefined) => {
    if (!value) return null;
    // First try company-filtered categories
    const found = categories.find((c) => c.id === value || c.name === value);
    if (found) return found;
    // Fallback to all user categories (cross-context)
    if (allCategories) {
      return allCategories.find((c) => c.id === value || c.name === value) ?? null;
    }
    return null;
  };

  const getCategoryHierarchy = (t: Transaction) => {
    const parts: string[] = [];
    const cat = findCategory(t.category);
    if (cat) parts.push(cat.name);
    else if (t.category) parts.push(t.category);
    const sub = findCategory(t.subcategory);
    if (sub) parts.push(sub.name);
    else if (t.subcategory) parts.push(t.subcategory);
    const sub2 = findCategory(t.subcategory2);
    if (sub2) parts.push(sub2.name);
    else if (t.subcategory2) parts.push(t.subcategory2);
    return parts;
  };

  return { findCategory, getCategoryHierarchy };
}

function getInstallmentLabel(t: Transaction) {
  if (t.installment_number && t.installments_total) {
    return `${t.installment_number}/${t.installments_total}`;
  }
  return null;
}

function getAccountName(
  t: Transaction,
  bankAccounts: { id: string; name: string }[],
  wallets: { id: string; name: string }[],
  creditCards: CreditCardWithHierarchy[],
) {
  if (t.bank_account_id) return bankAccounts.find((a) => a.id === t.bank_account_id)?.name;
  if (t.wallet_id) return wallets.find((w) => w.id === t.wallet_id)?.name;
  if (t.credit_card_id) return creditCards.find((c) => c.id === t.credit_card_id)?.name;
  return null;
}

function getAccountIcon(t: Transaction) {
  if (t.bank_account_id) return <Landmark className="h-3 w-3" />;
  if (t.wallet_id) return <Wallet className="h-3 w-3" />;
  if (t.credit_card_id) return <CreditCard className="h-3 w-3" />;
  return null;
}

function getContactName(
  t: Transaction,
  suppliers: { id: string; name: string }[],
  clients: { id: string; name: string }[],
) {
  if (t.contact_name) return t.contact_name;
  if (t.supplier_id) return suppliers.find((s) => s.id === t.supplier_id)?.name || null;
  if (t.client_id) return clients.find((c) => c.id === t.client_id)?.name || null;
  return null;
}

// ── Single Transaction Row ──────────────────────────────

interface TransactionRowProps {
  t: Transaction;
  categories: Category[];
  allCategories?: Category[];
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: CreditCardWithHierarchy[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onEdit: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onLiquidate: (t: Transaction) => void;
  onViewDetails: (t: Transaction) => void;
  indented?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

function TransactionRow({
  t, categories, allCategories, bankAccounts, wallets, creditCards, suppliers, clients,
  onEdit, onDuplicate, onDelete, onLiquidate, onViewDetails, indented,
  isSelected, onToggleSelect, selectionMode,
}: TransactionRowProps) {
  const { getCategoryHierarchy } = useCategoryHelpers(categories, allCategories);
  const installment = getInstallmentLabel(t);
  const categoryParts = getCategoryHierarchy(t);
  const accountName = getAccountName(t, bankAccounts, wallets, creditCards);
  const accountIcon = getAccountIcon(t);
  const contactName = getContactName(t, suppliers, clients);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group cursor-pointer ${indented ? "pl-10" : ""} ${isSelected ? "bg-accent/40" : ""}`}
      onClick={() => selectionMode && onToggleSelect ? onToggleSelect(t.id) : onViewDetails(t)}
    >
      {/* Checkbox */}
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect?.(t.id)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
      )}
      {/* Date */}
      <div className="text-center shrink-0 w-12">
        <div className="text-lg font-bold leading-tight text-foreground">
          {format(new Date(t.payment_date + "T00:00:00"), "dd")}
        </div>
        <div className="text-[10px] uppercase text-muted-foreground leading-tight">
          {format(new Date(t.payment_date + "T00:00:00"), "MMM", { locale: ptBR })}
        </div>
      </div>

      {/* Description + Category + Account + Contact */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {t.description}
          </span>
          {(t as any).isRecurring && (
            <Badge variant="outline" className="text-[10px] shrink-0 gap-0.5 border-primary/30 text-primary">
              <Repeat className="h-2.5 w-2.5" />
              Recorrente
            </Badge>
          )}
          {t.series_id && !installment && !(t as any).isRecurring && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              FIXO
            </Badge>
          )}
          {installment && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {installment}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {categoryParts.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {categoryParts.join(" › ")}
            </p>
          )}
          {accountName && !indented && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 shrink-0">
              {accountIcon}
              {accountName}
            </span>
          )}
        </div>
        {contactName && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {contactName}
          </p>
        )}
      </div>

      {/* Value */}
      <div className="text-right shrink-0">
        <span
          className={`text-sm font-semibold ${
            t.type === "receita"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {t.type === "receita" ? "+" : "-"} {formatCurrency(t.amount)}
        </span>
      </div>

      {/* Status */}
      <Badge
        variant={t.status === "Pago" ? "default" : "secondary"}
        className="text-[10px] shrink-0 hidden sm:inline-flex"
      >
        {t.status === "Pago" ? "Liquidado" : "Pendente"}
      </Badge>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(t); }}>
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(t); }}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(t)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          {t.status === "Pendente" && (
            <DropdownMenuItem onClick={() => onLiquidate(t)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Liquidar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onDelete(t)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Card Group Header ───────────────────────────────────

interface CardGroupItem {
  cardId: string;
  cardName: string;
  transactions: Transaction[];
  totalAmount: number;
  pendingCount: number;
  firstDate: string;
}

function CardGroupHeader({
  group,
  isOpen,
  onToggle,
  onLiquidate,
}: {
  group: CardGroupItem;
  isOpen: boolean;
  onToggle: () => void;
  onLiquidate: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer bg-muted/20"
      onClick={onToggle}
    >
      <div className="shrink-0 w-12 flex items-center justify-center">
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {group.cardName}
          </span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {group.transactions.length} lançamento{group.transactions.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">
          - {formatCurrency(group.totalAmount)}
        </span>
      </div>

      {group.pendingCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs gap-1 hidden sm:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onLiquidate();
          }}
        >
          <CheckCircle2 className="h-3 w-3" />
          Pagar Fatura
        </Button>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export function TransactionTable({
  transactions,
  loading,
  categories,
  allCategories,
  bankAccounts,
  wallets,
  creditCards,
  suppliers,
  clients,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onEdit,
  onDuplicate,
  onDelete,
  onDeleteMultiple,
  onLiquidate,
  onViewDetails,
}: TransactionTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  // Build ordered render list: group card transactions, keep others inline
  const renderItems = useMemo(() => {
    const items: Array<{ type: "transaction"; data: Transaction } | { type: "cardGroup"; data: CardGroupItem }> = [];
    const cardGroups = new Map<string, Transaction[]>();
    const nonCardTransactions: Array<{ index: number; t: Transaction }> = [];

    transactions.forEach((t, i) => {
      if (t.credit_card_id) {
        const existing = cardGroups.get(t.credit_card_id);
        if (existing) {
          existing.push(t);
        } else {
          cardGroups.set(t.credit_card_id, [t]);
          // Mark position of first occurrence
          nonCardTransactions.push({ index: i, t: { ...t, __cardGroupMarker: true } as any });
        }
      } else {
        nonCardTransactions.push({ index: i, t });
      }
    });

    // Re-assemble in order
    for (const { t } of nonCardTransactions) {
      if ((t as any).__cardGroupMarker && t.credit_card_id) {
        const cardTxns = cardGroups.get(t.credit_card_id)!;
        const cardName = creditCards.find((c) => c.id === t.credit_card_id)?.name || "Cartão";
        const totalAmount = cardTxns.reduce((s, tx) => s + tx.amount, 0);
        const pendingCount = cardTxns.filter((tx) => tx.status === "Pendente").length;

        if (cardTxns.length === 1) {
          // Single card transaction — render as normal row
          items.push({ type: "transaction", data: cardTxns[0] });
        } else {
          items.push({
            type: "cardGroup",
            data: {
              cardId: t.credit_card_id!,
              cardName,
              transactions: cardTxns,
              totalAmount,
              pendingCount,
              firstDate: cardTxns[0].payment_date,
            },
          });
        }
      } else {
        items.push({ type: "transaction", data: t });
      }
    }

    return items;
  }, [transactions, creditCards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum lançamento encontrado</p>
        <p className="text-xs mt-1">Tente ajustar os filtros ou crie um novo lançamento</p>
      </div>
    );
  }

  const rowProps = { categories, allCategories, bankAccounts, wallets, creditCards, suppliers, clients, onEdit, onDuplicate, onDelete, onLiquidate, onViewDetails, selectionMode, onToggleSelect: toggleSelect };

  return (
    <div className="space-y-0 divide-y divide-border">
      {/* Bulk action bar */}
      {selectionMode && (
        <div className="flex items-center gap-3 px-4 py-2 bg-accent/50 rounded-md mb-1">
          <Checkbox
            checked={selectedIds.size === transactions.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          {onDeleteMultiple && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onDeleteMultiple(Array.from(selectedIds));
                clearSelection();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir {selectedIds.size}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Select all toggle when not in selection mode */}
      {!selectionMode && transactions.length > 0 && onDeleteMultiple && (
        <div className="flex items-center gap-2 px-4 py-1.5">
          <Checkbox
            checked={false}
            onCheckedChange={() => toggleSelectAll()}
            className="opacity-40 hover:opacity-100 transition-opacity"
          />
          <span className="text-xs text-muted-foreground">Selecionar</span>
        </div>
      )}

      {renderItems.map((item) => {
        if (item.type === "transaction") {
          return (
            <TransactionRow
              key={item.data.id}
              t={item.data}
              {...rowProps}
              isSelected={selectedIds.has(item.data.id)}
            />
          );
        }

        const group = item.data;
        const isOpen = expandedCards.has(group.cardId);
        const allGroupSelected = group.transactions.every((t) => selectedIds.has(t.id));
        const someGroupSelected = group.transactions.some((t) => selectedIds.has(t.id));

        return (
          <div key={`card-group-${group.cardId}`}>
            <div className="flex items-center">
              {selectionMode && (
                <div className="pl-4 shrink-0">
                  <Checkbox
                    checked={allGroupSelected}
                    onCheckedChange={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (allGroupSelected) {
                          group.transactions.forEach((t) => next.delete(t.id));
                        } else {
                          group.transactions.forEach((t) => next.add(t.id));
                        }
                        return next;
                      });
                    }}
                  />
                </div>
              )}
              <div className="flex-1">
                <CardGroupHeader
                  group={group}
                  isOpen={isOpen}
                  onToggle={() => toggleCard(group.cardId)}
                  onLiquidate={() => {
                    const firstPending = group.transactions.find((tx) => tx.status === "Pendente");
                    if (firstPending) onLiquidate(firstPending);
                  }}
                />
              </div>
            </div>
            {isOpen && (
              <div className="border-l-2 border-primary/20 ml-6">
                {group.transactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    t={t}
                    {...rowProps}
                    indented
                    isSelected={selectedIds.has(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
          <p className="text-xs text-muted-foreground">
            {totalCount} lançamento{totalCount !== 1 ? "s" : ""} • Página{" "}
            {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

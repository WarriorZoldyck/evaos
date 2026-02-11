import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit, Copy, Trash2, CheckCircle2, MoreHorizontal, Loader2,
  Landmark, Wallet, CreditCard, HelpCircle, Eye, Repeat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Transaction, Category } from "@/hooks/useTransactions";

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  categories: Category[];
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onLiquidate: (transaction: Transaction) => void;
  onViewDetails: (transaction: Transaction) => void;
}

export function TransactionTable({
  transactions,
  loading,
  categories,
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
  onLiquidate,
  onViewDetails,
}: TransactionTableProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  const findCategory = (value: string | null | undefined) => {
    if (!value) return null;
    return categories.find((c) => c.id === value || c.name === value) ?? null;
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

  const getInstallmentLabel = (t: Transaction) => {
    if (t.installment_number && t.installments_total) {
      return `${t.installment_number}/${t.installments_total}`;
    }
    return null;
  };

  const getAccountName = (t: Transaction) => {
    if (t.bank_account_id) return bankAccounts.find((a) => a.id === t.bank_account_id)?.name;
    if (t.wallet_id) return wallets.find((w) => w.id === t.wallet_id)?.name;
    if (t.credit_card_id) return creditCards.find((c) => c.id === t.credit_card_id)?.name;
    return null;
  };

  const getAccountIcon = (t: Transaction) => {
    if (t.bank_account_id) return <Landmark className="h-3 w-3" />;
    if (t.wallet_id) return <Wallet className="h-3 w-3" />;
    if (t.credit_card_id) return <CreditCard className="h-3 w-3" />;
    return null;
  };

  const getContactName = (t: Transaction) => {
    if (t.contact_name) return t.contact_name;
    if (t.supplier_id) return suppliers.find((s) => s.id === t.supplier_id)?.name || null;
    if (t.client_id) return clients.find((c) => c.id === t.client_id)?.name || null;
    return null;
  };

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

  return (
    <div className="space-y-0 divide-y divide-border">
      {transactions.map((t) => {
        const installment = getInstallmentLabel(t);
        const categoryParts = getCategoryHierarchy(t);
        const accountName = getAccountName(t);
        const accountIcon = getAccountIcon(t);
        const contactName = getContactName(t);

        return (
          <div
            key={t.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group cursor-pointer"
            onClick={() => onViewDetails(t)}
          >
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
                {accountName && (
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

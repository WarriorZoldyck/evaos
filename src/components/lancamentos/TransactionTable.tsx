import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit, Copy, Trash2, CheckCircle2, MoreHorizontal, Loader2,
  ChevronDown, ChevronRight, Landmark, Wallet, CreditCard, HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onLiquidate: (transaction: Transaction) => void;
}

export function TransactionTable({
  transactions,
  loading,
  categories,
  bankAccounts,
  wallets,
  creditCards,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onEdit,
  onDuplicate,
  onDelete,
  onLiquidate,
}: TransactionTableProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  const getCategoryHierarchy = (t: Transaction) => {
    const parts: string[] = [];
    const cat = categories.find((c) => c.id === t.category);
    if (cat) parts.push(cat.name);
    if (t.subcategory) {
      const sub = categories.find((c) => c.id === t.subcategory);
      if (sub) parts.push(sub.name);
    }
    if (t.subcategory2) {
      const sub2 = categories.find((c) => c.id === t.subcategory2);
      if (sub2) parts.push(sub2.name);
    }
    return parts;
  };

  const getInstallmentLabel = (t: Transaction) => {
    if (t.installment_number && t.installments_total) {
      return `${t.installment_number}/${t.installments_total}`;
    }
    return null;
  };

  // Group transactions by account
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { transactions: Transaction[]; name: string; iconType: string }
    >();

    transactions.forEach((t) => {
      let key: string;
      let name: string;
      let iconType: string;

      if (t.bank_account_id) {
        key = `bank:${t.bank_account_id}`;
        name = bankAccounts.find((a) => a.id === t.bank_account_id)?.name || "Conta Bancária";
        iconType = "bank";
      } else if (t.wallet_id) {
        key = `wallet:${t.wallet_id}`;
        name = wallets.find((w) => w.id === t.wallet_id)?.name || "Carteira";
        iconType = "wallet";
      } else if (t.credit_card_id) {
        key = `card:${t.credit_card_id}`;
        name = creditCards.find((c) => c.id === t.credit_card_id)?.name || "Cartão";
        iconType = "card";
      } else {
        key = "none";
        name = "Sem conta vinculada";
        iconType = "none";
      }

      if (!map.has(key)) {
        map.set(key, { transactions: [], name, iconType });
      }
      map.get(key)!.transactions.push(t);
    });

    return Array.from(map.entries());
  }, [transactions, bankAccounts, wallets, creditCards]);

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

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "bank": return <Landmark className="h-4 w-4" />;
      case "wallet": return <Wallet className="h-4 w-4" />;
      case "card": return <CreditCard className="h-4 w-4" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3">
      {groups.map(([key, group]) => {
        const balance = group.transactions.reduce(
          (acc, t) => (t.type === "receita" ? acc + t.amount : acc - t.amount),
          0
        );

        return (
          <AccountGroup
            key={key}
            icon={getIcon(group.iconType)}
            name={group.name}
            count={group.transactions.length}
            balance={balance}
            formatCurrency={formatCurrency}
          >
            {group.transactions.map((t) => {
              const installment = getInstallmentLabel(t);
              const categoryParts = getCategoryHierarchy(t);

              return (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  installment={installment}
                  categoryParts={categoryParts}
                  formatCurrency={formatCurrency}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onLiquidate={onLiquidate}
                />
              );
            })}
          </AccountGroup>
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

// ── Account Group (collapsible) ────────────────────────────────
function AccountGroup({
  icon,
  name,
  count,
  balance,
  formatCurrency,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  count: number;
  balance: number;
  formatCurrency: (n: number) => string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <span className="font-medium text-sm">{name}</span>
        <Badge variant="secondary" className="text-xs shrink-0">
          {count} mov.
        </Badge>
        <span
          className={`ml-auto text-sm font-semibold shrink-0 ${
            balance >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {formatCurrency(balance)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y divide-border">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Transaction Row ────────────────────────────────────────────
function TransactionRow({
  transaction: t,
  installment,
  categoryParts,
  formatCurrency,
  onEdit,
  onDuplicate,
  onDelete,
  onLiquidate,
}: {
  transaction: Transaction;
  installment: string | null;
  categoryParts: string[];
  formatCurrency: (n: number) => string;
  onEdit: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onLiquidate: (t: Transaction) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
      {/* Date */}
      <div className="text-center shrink-0 w-12">
        <div className="text-lg font-bold leading-tight text-foreground">
          {format(new Date(t.payment_date + "T00:00:00"), "dd")}
        </div>
        <div className="text-[10px] uppercase text-muted-foreground leading-tight">
          {format(new Date(t.payment_date + "T00:00:00"), "MMM", { locale: ptBR })}
        </div>
      </div>

      {/* Description + Category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {t.description}
          </span>
          {t.series_id && !installment && (
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
        {categoryParts.length > 0 && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {categoryParts.join(" › ")}
          </p>
        )}
        {t.contact_name && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {t.contact_name}
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
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(t)}>
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

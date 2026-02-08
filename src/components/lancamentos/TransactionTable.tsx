import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit,
  Copy,
  Trash2,
  CheckCircle2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  page,
  totalPages,
  totalCount,
  onPageChange,
  onEdit,
  onDuplicate,
  onDelete,
  onLiquidate,
}: TransactionTableProps) {
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || categoryId;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const getInstallmentLabel = (t: Transaction) => {
    if (t.installment_number && t.installments_total) {
      return `${t.installment_number}/${t.installments_total}`;
    }
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
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Contato</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const installment = getInstallmentLabel(t);
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(t.payment_date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px] lg:max-w-none">
                        {t.description}
                      </span>
                      {installment && (
                        <span className="text-xs text-muted-foreground">
                          Parcela {installment}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {getCategoryName(t.category)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {t.contact_name || "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span
                      className={
                        t.type === "receita"
                          ? "text-[hsl(var(--success))] font-medium text-sm"
                          : "text-[hsl(var(--destructive))] font-medium text-sm"
                      }
                    >
                      {t.type === "receita" ? "+" : "-"}{" "}
                      {formatCurrency(t.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant={t.status === "Pago" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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

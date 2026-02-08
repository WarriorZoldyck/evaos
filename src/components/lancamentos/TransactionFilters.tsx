import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransactionFilters as Filters, Category } from "@/hooks/useTransactions";

interface TransactionFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories: Category[];
}

export function TransactionFilters({
  filters,
  onFiltersChange,
  categories,
}: TransactionFiltersProps) {
  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>

      <Select
        value={filters.type}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            type: value as Filters["type"],
          })
        }
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          <SelectItem value="receita">Receitas</SelectItem>
          <SelectItem value="despesa">Despesas</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value as Filters["status"],
          })
        }
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="Pago">Pago</SelectItem>
          <SelectItem value="Pendente">Pendente</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.categoryId || "todas"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            categoryId: value === "todas" ? "" : value,
          })
        }
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as categorias</SelectItem>
          {rootCategories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
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

  const handleDateFrom = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: date ? format(date, "yyyy-MM-dd") : "",
    });
  };

  const handleDateTo = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateTo: date ? format(date, "yyyy-MM-dd") : "",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou contato..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="pl-9"
          />
        </div>

        {/* Type toggle */}
        <ToggleGroup
          type="single"
          value={filters.type}
          onValueChange={(value) => {
            if (value)
              onFiltersChange({
                ...filters,
                type: value as Filters["type"],
              });
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="todos" className="text-xs px-3">
            Tudo
          </ToggleGroupItem>
          <ToggleGroupItem value="receita" className="text-xs px-3">
            Entradas
          </ToggleGroupItem>
          <ToggleGroupItem value="despesa" className="text-xs px-3">
            Saídas
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Category */}
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

      {/* Date range */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[180px] justify-start text-left font-normal",
                !filters.dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom
                ? format(
                    new Date(filters.dateFrom + "T00:00:00"),
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )
                : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={
                filters.dateFrom
                  ? new Date(filters.dateFrom + "T00:00:00")
                  : undefined
              }
              onSelect={handleDateFrom}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[180px] justify-start text-left font-normal",
                !filters.dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo
                ? format(
                    new Date(filters.dateTo + "T00:00:00"),
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )
                : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={
                filters.dateTo
                  ? new Date(filters.dateTo + "T00:00:00")
                  : undefined
              }
              onSelect={handleDateTo}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {(filters.dateFrom || filters.dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onFiltersChange({ ...filters, dateFrom: "", dateTo: "" })
            }
            className="text-xs"
          >
            Limpar datas
          </Button>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Filter, ChevronRight as ChevronRightIcon, X, Check, Tag, Users, Building2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TransactionFilters as Filters, Category } from "@/hooks/useTransactions";

type PeriodKey = "today" | "week" | "month" | "year" | "custom" | "all";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];

function getDateRange(period: PeriodKey, ref: Date): { from: string; to: string } {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (period) {
    case "today":
      return { from: fmt(startOfDay(ref)), to: fmt(endOfDay(ref)) };
    case "week":
      return { from: fmt(startOfWeek(ref, { weekStartsOn: 0 })), to: fmt(endOfWeek(ref, { weekStartsOn: 0 })) };
    case "month":
      return { from: fmt(startOfMonth(ref)), to: fmt(endOfMonth(ref)) };
    case "year":
      return { from: fmt(startOfYear(ref)), to: fmt(endOfYear(ref)) };
    case "all":
      return { from: "", to: "" };
    default:
      return { from: fmt(startOfMonth(ref)), to: fmt(endOfMonth(ref)) };
  }
}

interface TransactionPeriodFilterProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function TransactionPeriodFilter({ filters, onFiltersChange }: TransactionPeriodFilterProps) {
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("month");
  const [navMonth, setNavMonth] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePeriodClick = (key: PeriodKey) => {
    setActivePeriod(key);
    if (key === "all") {
      onFiltersChange({ ...filters, dateFrom: "", dateTo: "" });
    } else {
      const now = new Date();
      setNavMonth(now);
      const range = getDateRange(key, now);
      onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.to });
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = direction === "prev" ? subMonths(navMonth, 1) : addMonths(navMonth, 1);
    setNavMonth(newMonth);
    setActivePeriod("custom");
    onFiltersChange({
      ...filters,
      dateFrom: format(startOfMonth(newMonth), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(newMonth), "yyyy-MM-dd"),
    });
  };

  const monthLabel = format(navMonth, "MMM yyyy", { locale: ptBR });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {periodOptions.map((opt) => (
        <Button
          key={opt.key}
          variant={activePeriod === opt.key ? "default" : "outline"}
          size="sm"
          className="text-xs h-8"
          onClick={() => handlePeriodClick(opt.key)}
        >
          {opt.label}
        </Button>
      ))}

      <div className="flex items-center gap-0.5 ml-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigateMonth("prev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={activePeriod === "custom" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 min-w-[90px] capitalize"
            >
              {monthLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              locale={ptBR}
              className="pointer-events-auto"
              selected={{
                from: filters.dateFrom ? new Date(filters.dateFrom + "T00:00:00") : undefined,
                to: filters.dateTo ? new Date(filters.dateTo + "T00:00:00") : undefined,
              }}
              onSelect={(range) => {
                if (range?.from) {
                  setActivePeriod("custom");
                  onFiltersChange({
                    ...filters,
                    dateFrom: format(range.from, "yyyy-MM-dd"),
                    dateTo: range.to ? format(range.to, "yyyy-MM-dd") : format(range.from, "yyyy-MM-dd"),
                  });
                  if (range.to) setCalendarOpen(false);
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigateMonth("next")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface TransactionSearchInputProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  className?: string;
}

export function TransactionSearchInput({ filters, onFiltersChange, className }: TransactionSearchInputProps) {
  return (
    <div className={`relative ${className ?? "w-64"}`}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Buscar lançamento..."
        value={filters.search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        className="pl-8 h-8 text-xs"
      />
    </div>
  );
}

interface TransactionFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories: Category[];
  bankAccounts?: { id: string; name: string }[];
  wallets?: { id: string; name: string }[];
  creditCards?: { id: string; name: string; last_four_digits: string | null; parent_card_id?: string | null }[];
  suppliers?: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
  hidePeriod?: boolean;
  hideSearch?: boolean;
}

export function TransactionFilters({
  filters,
  onFiltersChange,
  categories,
  bankAccounts = [],
  wallets = [],
  creditCards = [],
  suppliers = [],
  clients = [],
  hidePeriod = false,
  hideSearch = false,
}: TransactionFiltersProps) {
  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-stretch sm:items-center gap-2">
        {/* Search */}
        {!hideSearch && (
          <div className="relative min-w-[200px] flex-1">
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
        )}

        {/* Type toggle */}
        <ToggleGroup
          type="single"
          value={filters.type}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({ ...filters, type: value as Filters["type"] });
          }}
          className="h-10"
        >
          <ToggleGroupItem value="todos" className="h-10 px-3 text-xs">Tudo</ToggleGroupItem>
          <ToggleGroupItem value="receita" className="h-10 px-3 text-xs gap-1">
            <ArrowUp className="h-3.5 w-3.5" /> Entradas
          </ToggleGroupItem>
          <ToggleGroupItem value="despesa" className="h-10 px-3 text-xs gap-1">
            <ArrowDown className="h-3.5 w-3.5" /> Saídas
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Reconciliation toggle */}
        <ToggleGroup
          type="single"
          value={filters.reconciled}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({ ...filters, reconciled: value as Filters["reconciled"] });
          }}
          className="h-10"
        >
          <ToggleGroupItem value="todos" className="h-10 px-3 text-xs">Todos</ToggleGroupItem>
          <ToggleGroupItem value="sim" className="h-10 px-3 text-xs">Conciliados</ToggleGroupItem>
          <ToggleGroupItem value="nao" className="h-10 px-3 text-xs">Sem conciliação</ToggleGroupItem>
        </ToggleGroup>




        {/* Sort order */}
          <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 h-10"
          onClick={() =>
            onFiltersChange({
              ...filters,
              sortOrder: filters.sortOrder === "desc" ? "asc" : "desc",
            })
          }
        >
          {filters.sortOrder === "desc" ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
          <span className="text-xs">
            {filters.sortOrder === "desc" ? "Recentes" : "Antigos"}
          </span>
        </Button>

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
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            <SelectItem value="__sem_categoria__">Sem categoria</SelectItem>
            {rootCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account / Wallet filter */}
        {(bankAccounts.length > 0 || wallets.length > 0 || creditCards.length > 0) && (
          <Select
            value={filters.accountId || "todas"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                accountId: value === "todas" ? "" : value,
              })
            }
          >
            <SelectTrigger className="w-full sm:w-[200px] h-10">
              <SelectValue placeholder="Conta / Carteira" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {bankAccounts.map((acc) => (
                <SelectItem key={`bank:${acc.id}`} value={`bank:${acc.id}`}>
                  🏦 {acc.name}
                </SelectItem>
              ))}
              {wallets.map((w) => (
                <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`}>
                  👛 {w.name}
                </SelectItem>
              ))}
              {creditCards
                .filter(cc => !cc.parent_card_id)
                .map((parent) => (
                  <SelectItem key={`card:${parent.id}`} value={`card:${parent.id}`}>
                    💳 {parent.name}{parent.last_four_digits ? ` •${parent.last_four_digits}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Child card sub-filter — only when a parent card with children is selected */}
        {filters.accountId?.startsWith("card:") && (() => {
          const selectedCardId = filters.accountId.split(":").slice(1).join(":");
          const children = creditCards.filter(cc => cc.parent_card_id === selectedCardId);
          if (children.length === 0) return null;
          return (
            <Select
              value={filters.accountId}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, accountId: value })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <SelectValue placeholder="Sub-cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={`card:${selectedCardId}`}>
                  Todos do grupo
                </SelectItem>
                {children.map((child) => (
                  <SelectItem key={`card:${child.id}`} value={`card:${child.id}`}>
                    ↳ {child.name}{child.last_four_digits ? ` •${child.last_four_digits}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}


        {suppliers.length > 0 && (
          <Select
            value={filters.supplierId || "todos"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                supplierId: value === "todos" ? "" : value,
              })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Client filter */}
        {clients.length > 0 && (
          <Select
            value={filters.clientId || "todos"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                clientId: value === "todos" ? "" : value,
              })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

      </div>

      {!hidePeriod && (
        <TransactionPeriodFilter filters={filters} onFiltersChange={onFiltersChange} />
      )}
    </div>
  );
}

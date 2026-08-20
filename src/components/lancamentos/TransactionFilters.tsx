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
import { flattenCategoryOptions, type FlatCategoryOption } from "@/lib/categoryTree";


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

type EntityLevel = "root" | "categoria" | "fornecedor" | "cliente";

interface UnifiedEntityFilterProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  rootCategories: FlatCategoryOption[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}

function UnifiedEntityFilter({
  filters,
  onFiltersChange,
  rootCategories,
  suppliers,
  clients,
}: UnifiedEntityFilterProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<EntityLevel>("root");
  const [query, setQuery] = useState("");

  const activeCount =
    (filters.categoryId ? 1 : 0) +
    (filters.supplierId ? 1 : 0) +
    (filters.clientId ? 1 : 0);

  const categoryLabel = useMemo(() => {
    if (!filters.categoryId) return null;
    if (filters.categoryId === "__sem_categoria__") return "Sem categoria";
    return rootCategories.find((c) => c.id === filters.categoryId)?.name ?? null;
  }, [filters.categoryId, rootCategories]);

  const supplierLabel = useMemo(
    () => (filters.supplierId ? suppliers.find((s) => s.id === filters.supplierId)?.name ?? null : null),
    [filters.supplierId, suppliers],
  );

  const clientLabel = useMemo(
    () => (filters.clientId ? clients.find((c) => c.id === filters.clientId)?.name ?? null : null),
    [filters.clientId, clients],
  );

  const goRoot = () => {
    setLevel("root");
    setQuery("");
  };

  const enterLevel = (l: EntityLevel) => {
    setLevel(l);
    setQuery("");
  };

  const clearCategory = () => onFiltersChange({ ...filters, categoryId: "" });
  const clearSupplier = () => onFiltersChange({ ...filters, supplierId: "" });
  const clearClient = () => onFiltersChange({ ...filters, clientId: "" });

  const filterList = <T extends { name: string }>(items: T[]) =>
    query.trim()
      ? items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
      : items;

  const renderRow = (opts: {
    icon: React.ReactNode;
    label: string;
    value: string | null;
    onClear: () => void;
    onOpen: () => void;
  }) => (
    <button
      type="button"
      onClick={opts.onOpen}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-left"
    >
      <span className="text-muted-foreground shrink-0">{opts.icon}</span>
      <span className="text-sm font-medium shrink-0">{opts.label}</span>
      {opts.value ? (
        <span className="ml-auto flex items-center gap-1 min-w-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[140px]">
            {opts.value}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              opts.onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                opts.onClear();
              }
            }}
            className="p-0.5 rounded hover:bg-muted"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </span>
      ) : (
        <ChevronRightIcon className="h-4 w-4 ml-auto text-muted-foreground" />
      )}
    </button>
  );

  const renderOption = (opts: {
    key: string;
    label: string;
    selected: boolean;
    onSelect: () => void;
    muted?: boolean;
  }) => (
    <button
      key={opts.key}
      type="button"
      onClick={() => {
        opts.onSelect();
        goRoot();
      }}
      className={`w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-left text-sm ${
        opts.muted ? "text-muted-foreground italic" : ""
      }`}
    >
      <span className="w-4 shrink-0">
        {opts.selected ? <Check className="h-4 w-4 text-primary" /> : null}
      </span>
      <span className="truncate">{opts.label}</span>
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) goRoot();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 h-10 gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-xs">Filtrar por</span>
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 bg-popover">
        {level === "root" && (
          <div className="space-y-0.5">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Filtrar por
            </div>
            {renderRow({
              icon: <Tag className="h-4 w-4" />,
              label: "Categoria",
              value: categoryLabel,
              onClear: clearCategory,
              onOpen: () => enterLevel("categoria"),
            })}
            {suppliers.length > 0 &&
              renderRow({
                icon: <Building2 className="h-4 w-4" />,
                label: "Fornecedor",
                value: supplierLabel,
                onClear: clearSupplier,
                onOpen: () => enterLevel("fornecedor"),
              })}
            {clients.length > 0 &&
              renderRow({
                icon: <Users className="h-4 w-4" />,
                label: "Cliente",
                value: clientLabel,
                onClear: clearClient,
                onOpen: () => enterLevel("cliente"),
              })}
          </div>
        )}

        {level !== "root" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={goRoot}>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Voltar</span>
              </Button>
              <span className="text-xs font-medium capitalize">{level}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={`Buscar ${level}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {level === "categoria" && (
                <>
                  {renderOption({
                    key: "todas",
                    label: "Todas as categorias",
                    selected: !filters.categoryId,
                    onSelect: () => onFiltersChange({ ...filters, categoryId: "" }),
                  })}
                  {renderOption({
                    key: "__sem_categoria__",
                    label: "Sem categoria",
                    selected: filters.categoryId === "__sem_categoria__",
                    onSelect: () =>
                      onFiltersChange({ ...filters, categoryId: "__sem_categoria__" }),
                    muted: true,
                  })}
                  {filterList(rootCategories).map((cat) => {
                    const depth = (cat as unknown as { depth?: number }).depth ?? 0;
                    const leaf =
                      (cat as unknown as { leafName?: string }).leafName ?? cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          onFiltersChange({ ...filters, categoryId: cat.id });
                          goRoot();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-left text-sm"
                        style={{ paddingLeft: 8 + depth * 14 }}
                      >
                        <span className="w-4 shrink-0">
                          {filters.categoryId === cat.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : null}
                        </span>
                        <span
                          className={`truncate ${depth > 0 ? "text-muted-foreground" : "font-medium"}`}
                          title={cat.name}
                        >
                          {depth > 0 ? "› " : ""}
                          {leaf}
                        </span>
                      </button>
                    );
                  })}

                </>
              )}
              {level === "fornecedor" && (
                <>
                  {renderOption({
                    key: "todos",
                    label: "Todos os fornecedores",
                    selected: !filters.supplierId,
                    onSelect: () => onFiltersChange({ ...filters, supplierId: "" }),
                  })}
                  {filterList(suppliers).map((s) =>
                    renderOption({
                      key: s.id,
                      label: s.name,
                      selected: filters.supplierId === s.id,
                      onSelect: () => onFiltersChange({ ...filters, supplierId: s.id }),
                    }),
                  )}
                </>
              )}
              {level === "cliente" && (
                <>
                  {renderOption({
                    key: "todos",
                    label: "Todos os clientes",
                    selected: !filters.clientId,
                    onSelect: () => onFiltersChange({ ...filters, clientId: "" }),
                  })}
                  {filterList(clients).map((c) =>
                    renderOption({
                      key: c.id,
                      label: c.name,
                      selected: filters.clientId === c.id,
                      onSelect: () => onFiltersChange({ ...filters, clientId: c.id }),
                    }),
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
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
  const rootCategories = useMemo(() => flattenCategoryOptions(categories), [categories]);

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
          className="h-9 bg-muted rounded-md p-1 gap-0"
        >
          <ToggleGroupItem value="todos" className="h-7 px-3 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">Tudo</ToggleGroupItem>
          <ToggleGroupItem value="receita" className="h-7 px-3 text-xs gap-1 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">
            <ArrowUp className="h-3.5 w-3.5" /> Entradas
          </ToggleGroupItem>
          <ToggleGroupItem value="despesa" className="h-7 px-3 text-xs gap-1 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">
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
          className="h-9 bg-muted rounded-md p-1 gap-0"
        >
          <ToggleGroupItem value="todos" className="h-7 px-3 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">Todos</ToggleGroupItem>
          <ToggleGroupItem value="sim" className="h-7 px-3 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">Conciliados</ToggleGroupItem>
          <ToggleGroupItem value="nao" className="h-7 px-3 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm">Sem conciliação</ToggleGroupItem>
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

        {/* Unified entity filter (Categoria / Fornecedor / Cliente) */}
        <UnifiedEntityFilter
          filters={filters}
          onFiltersChange={onFiltersChange}
          rootCategories={rootCategories}
          suppliers={suppliers}
          clients={clients}
        />


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


      </div>

      {!hidePeriod && (
        <TransactionPeriodFilter filters={filters} onFiltersChange={onFiltersChange} />
      )}
    </div>
  );
}

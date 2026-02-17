import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DREFilters, DREGranularity } from "@/hooks/useDREData";

interface DREPeriodFilterProps {
  filters: DREFilters;
  onChange: (partial: Partial<DREFilters>) => void;
  bankAccounts: { id: string; name: string }[];
}

export function DREPeriodFilter({ filters, onChange, bankAccounts }: DREPeriodFilterProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Account filter */}
      <Select
        value={filters.accountId || "__all__"}
        onValueChange={(v) => onChange({ accountId: v === "__all__" ? null : v })}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Todas as contas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas as contas</SelectItem>
          {bankAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Granularity */}
      <Select
        value={filters.granularity}
        onValueChange={(v) => onChange({ granularity: v as DREGranularity })}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Mensal</SelectItem>
          <SelectItem value="quarterly">Trimestral</SelectItem>
          <SelectItem value="semiannual">Semestral</SelectItem>
        </SelectContent>
      </Select>

      {/* Year navigation */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange({ year: filters.year - 1 })}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={String(filters.year)} onValueChange={(v) => onChange({ year: Number(v) })}>
          <SelectTrigger className="w-[80px] h-8 text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange({ year: filters.year + 1 })}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

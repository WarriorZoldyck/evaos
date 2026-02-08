import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PeriodKey, DashboardFilters } from "@/hooks/useDashboardData";

interface PeriodFilterProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodFilter({ filters, onChange }: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePeriodClick = (key: PeriodKey) => {
    if (key === "custom") {
      setCalendarOpen(true);
      onChange({ ...filters, period: key });
    } else {
      onChange({ period: key });
    }
  };

  const customLabel =
    filters.period === "custom" && filters.customStart && filters.customEnd
      ? `${format(filters.customStart, "dd/MM", { locale: ptBR })} - ${format(filters.customEnd, "dd/MM", { locale: ptBR })}`
      : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {periodOptions.map((opt) =>
        opt.key === "custom" ? (
          <Popover key={opt.key} open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={filters.period === "custom" ? "default" : "outline"}
                size="sm"
                className="text-xs h-8 gap-1.5"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {customLabel || opt.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                locale={ptBR}
                selected={{
                  from: filters.customStart,
                  to: filters.customEnd,
                }}
                onSelect={(range) => {
                  if (range?.from) {
                    onChange({
                      period: "custom",
                      customStart: range.from,
                      customEnd: range.to || range.from,
                    });
                    if (range.to) setCalendarOpen(false);
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            key={opt.key}
            variant={filters.period === opt.key ? "default" : "outline"}
            size="sm"
            className="text-xs h-8"
            onClick={() => handlePeriodClick(opt.key)}
          >
            {opt.label}
          </Button>
        )
      )}
    </div>
  );
}

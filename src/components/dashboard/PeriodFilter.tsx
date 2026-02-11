import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
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
];

export function PeriodFilter({ filters, onChange }: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [navMonth, setNavMonth] = useState(new Date());

  const handlePeriodClick = (key: PeriodKey) => {
    onChange({ period: key });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = direction === "prev" ? subMonths(navMonth, 1) : addMonths(navMonth, 1);
    setNavMonth(newMonth);
    onChange({
      period: "custom",
      customStart: startOfMonth(newMonth),
      customEnd: endOfMonth(newMonth),
    });
  };

  const monthLabel = format(navMonth, "MMM yyyy", { locale: ptBR });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {periodOptions.map((opt) => (
        <Button
          key={opt.key}
          variant={filters.period === opt.key ? "default" : "outline"}
          size="sm"
          className="text-xs h-8"
          onClick={() => handlePeriodClick(opt.key)}
        >
          {opt.label}
        </Button>
      ))}

      {/* Month navigation */}
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
              variant={filters.period === "custom" ? "default" : "outline"}
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

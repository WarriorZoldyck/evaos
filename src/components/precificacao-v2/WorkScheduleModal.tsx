import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  monthSchedule,
  availableHoursFromSchedule,
  productiveHours,
  dayHours,
  formatHours,
  toMonthKey,
  fromISODay,
  DEFAULT_RANGE,
  WEEKDAY_LABELS,
  WEEKDAY_FULL,
  type Weekday,
  type TimeRange,
  type WeekdaySchedule,
  type DayOverrides,
} from "@/lib/workHours";

const ORDERED_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export interface WorkScheduleValue {
  weekdaySchedule: WeekdaySchedule;
  dayOverrides: DayOverrides;
  observeHolidays: boolean;
  referenceMonth: string; // YYYY-MM
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: WorkScheduleValue;
  productiveLossPct: number;
  onSave: (value: WorkScheduleValue) => Promise<void> | void;
}

const minutesToLabel = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function WorkScheduleModal({ open, onOpenChange, value, productiveLossPct, onSave }: Props) {
  const [weekdaySchedule, setWeekdaySchedule] = useState<WeekdaySchedule>(value.weekdaySchedule);
  const [overrides, setOverrides] = useState<DayOverrides>(value.dayOverrides);
  const [observeHolidays, setObserveHolidays] = useState(value.observeHolidays);
  const [monthKey, setMonthKey] = useState(value.referenceMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [defaultRange, setDefaultRange] = useState<TimeRange>(
    Object.values(value.weekdaySchedule)[0] ?? DEFAULT_RANGE,
  );
  const [saving, setSaving] = useState(false);

  const [year, month] = monthKey.split("-").map(Number);

  const days = useMemo(
    () => monthSchedule(year, month, { weekdaySchedule, overrides, observeHolidays }),
    [year, month, weekdaySchedule, overrides, observeHolidays],
  );

  const available = availableHoursFromSchedule(days);
  const productive = productiveHours(available, productiveLossPct);
  const activeDays = days.filter((d) => d.hours > 0).length;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonthKey(toMonthKey(d.getFullYear(), d.getMonth() + 1));
    setSelectedDate(null);
  };

  const selected = days.find((d) => d.date === selectedDate) ?? null;

  const setDayRange = (date: string, range: TimeRange | null) =>
    setOverrides((prev) => ({ ...prev, [date]: range }));

  const resetDay = (date: string) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });

  const toggleWeekday = (w: Weekday) =>
    setWeekdaySchedule((prev) => {
      const next = { ...prev };
      if (next[w]) delete next[w];
      else next[w] = { ...defaultRange };
      return next;
    });

  const applyDefaultToSelectedWeekdays = (range: TimeRange) => {
    setDefaultRange(range);
    setWeekdaySchedule((prev) => {
      const next: WeekdaySchedule = {};
      for (const key of Object.keys(prev)) next[Number(key) as Weekday] = { ...range };
      return next;
    });
  };

  const applyToWeekday = () => {
    if (!selected?.range) return;
    const range = selected.range;
    setOverrides((prev) => {
      const next = { ...prev };
      for (const d of days) {
        if (d.weekday === selected.weekday) next[d.date] = { ...range };
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ weekdaySchedule, dayOverrides: overrides, observeHolidays, referenceMonth: monthKey });
    setSaving(false);
    onOpenChange(false);
  };

  // grade: preenche o offset do 1º dia
  const firstWeekday = days[0]?.weekday ?? 0;

  const updateSelected = (patch: Partial<TimeRange>) => {
    if (!selected) return;
    const base = selected.range ?? defaultRange;
    setDayRange(selected.date, { ...base, ...patch });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Editar jornada
          </DialogTitle>
        </DialogHeader>

        {/* Padrão da semana */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Dias da semana que trabalha</Label>
              <div className="flex gap-1.5">
                {ORDERED_WEEKDAYS.map((w) => {
                  const active = !!weekdaySchedule[w];
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={active}
                      aria-label={WEEKDAY_FULL[w]}
                      title={WEEKDAY_FULL[w]}
                      onClick={() => toggleWeekday(w)}
                      className={cn(
                        "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      {WEEKDAY_LABELS[w]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="wsm-start">Início padrão</Label>
              <Input
                id="wsm-start"
                type="time"
                className="w-[120px]"
                value={defaultRange.start}
                onChange={(e) => applyDefaultToSelectedWeekdays({ ...defaultRange, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="wsm-end">Fim padrão</Label>
              <Input
                id="wsm-end"
                type="time"
                className="w-[120px]"
                value={defaultRange.end}
                onChange={(e) => applyDefaultToSelectedWeekdays({ ...defaultRange, end: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="wsm-break">Intervalo (min)</Label>
              <Input
                id="wsm-break"
                type="number"
                min={0}
                step={15}
                className="w-[110px]"
                value={defaultRange.break}
                onChange={(e) =>
                  applyDefaultToSelectedWeekdays({
                    ...defaultRange,
                    break: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Switch id="wsm-holidays" checked={observeHolidays} onCheckedChange={setObserveHolidays} />
              <Label htmlFor="wsm-holidays" className="text-xs">Considerar feriados nacionais</Label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* Grade do mês */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold capitalize">{monthLabel}</p>
              <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
              {ORDERED_WEEKDAYS.map((w) => (
                <div key={w}>{WEEKDAY_LABELS[w]}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((d) => {
                const isOff = d.hours === 0;
                const isSelected = d.date === selectedDate;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={cn(
                      "min-h-[62px] rounded-md border p-1 text-left transition-colors",
                      isOff ? "bg-muted/40 text-muted-foreground" : "bg-primary/5 border-primary/30",
                      isSelected && "ring-2 ring-primary",
                    )}
                  >
                    <span className="text-xs font-semibold">{fromISODay(d.date).getDate()}</span>
                    {d.holidayName && (
                      <span className="block text-[9px] leading-tight text-chart-3 truncate" title={d.holidayName}>
                        {d.holidayName}
                      </span>
                    )}
                    {d.range ? (
                      <span className="block text-[9px] leading-tight">
                        {d.range.start}–{d.range.end}
                        <span className="block font-medium">{formatHours(d.hours)}</span>
                      </span>
                    ) : (
                      !d.holidayName && <span className="block text-[9px] leading-tight">Folga</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel lateral */}
          <div className="rounded-lg border p-3 space-y-3 h-fit">
            {!selected ? (
              <p className="text-xs text-muted-foreground">
                Clique num dia do calendário para ajustar o horário, marcar folga ou trabalhar num feriado.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold capitalize">
                  {fromISODay(selected.date).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
                {selected.holidayName && (
                  <p className="text-[11px] text-chart-3 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {selected.holidayName}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={selected.range?.start ?? defaultRange.start}
                    disabled={!selected.range}
                    onChange={(e) => updateSelected({ start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={selected.range?.end ?? defaultRange.end}
                    disabled={!selected.range}
                    onChange={(e) => updateSelected({ end: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Intervalo (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={selected.range?.break ?? defaultRange.break}
                    disabled={!selected.range}
                    onChange={(e) => updateSelected({ break: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  = {formatHours(dayHours(selected.range))} no dia
                </p>

                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">
                    {selected.holidayName ? "Vou trabalhar neste dia" : "Dia de trabalho"}
                  </Label>
                  <Switch
                    checked={!!selected.range}
                    onCheckedChange={(on) =>
                      setDayRange(selected.date, on ? { ...defaultRange } : null)
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <Button variant="outline" size="sm" onClick={applyToWeekday} disabled={!selected.range}>
                    Aplicar a todas as {WEEKDAY_FULL[selected.weekday].toLowerCase()}s
                  </Button>
                  {selected.overridden && (
                    <Button variant="ghost" size="sm" onClick={() => resetDay(selected.date)}>
                      Voltar ao padrão
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {activeDays} dias · {formatHours(available)} disponíveis ·{" "}
            <span className="text-primary font-medium">{formatHours(productive)} produtivas</span>
            {productiveLossPct > 0 && ` (−${productiveLossPct}%)`}
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { minutesToLabel };

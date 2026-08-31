import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Settings2, CalendarDays, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveConfigInput } from "@/hooks/usePricingV2";
import {
  availableHours,
  productiveHours,
  workingDaysOfMonth,
  toISODay,
  formatHours,
  WEEKDAY_LABELS,
  WEEKDAY_FULL,
  DEFAULT_WEEKDAYS,
  type Weekday,
} from "@/lib/workHours";

interface ConfigCardProps {
  hoursPerMonth: number;
  numRooms: number;
  taxRate: number;
  daysPerWeek: number | null;
  hoursPerDay: number | null;
  productiveLossPct?: number;
  workWeekdays?: Weekday[];
  excludedDays?: string[];
  onSave: (input: SaveConfigInput) => Promise<boolean>;
}

const ORDERED_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Converte ISO (YYYY-MM-DD) para Date local, sem deslocamento de fuso. */
const fromISODay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export function ConfigCard({
  hoursPerMonth,
  numRooms,
  taxRate,
  daysPerWeek,
  hoursPerDay,
  productiveLossPct = 0,
  workWeekdays = [],
  excludedDays = [],
  onSave,
}: ConfigCardProps) {
  const [rooms, setRooms] = useState(String(numRooms));
  const [tax, setTax] = useState(String(taxRate));
  const [hpd, setHpd] = useState(hoursPerDay != null ? String(hoursPerDay) : "");
  const [loss, setLoss] = useState(String(productiveLossPct ?? 0));
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    workWeekdays.length > 0 ? workWeekdays : daysPerWeek ? DEFAULT_WEEKDAYS : [],
  );
  const [excluded, setExcluded] = useState<string[]>(excludedDays);
  const [manualHours, setManualHours] = useState(String(hoursPerMonth));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRooms(String(numRooms));
    setTax(String(taxRate));
    setHpd(hoursPerDay != null ? String(hoursPerDay) : "");
    setLoss(String(productiveLossPct ?? 0));
    setWeekdays(workWeekdays.length > 0 ? workWeekdays : daysPerWeek ? DEFAULT_WEEKDAYS : []);
    setExcluded(excludedDays);
    setManualHours(String(hoursPerMonth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    numRooms,
    taxRate,
    hoursPerDay,
    daysPerWeek,
    productiveLossPct,
    hoursPerMonth,
    workWeekdays.join(","),
    excludedDays.join(","),
  ]);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthLabel = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const hpdNum = parseFloat(hpd.replace(",", ".")) || 0;
  const lossNum = Math.min(99.99, Math.max(0, parseFloat(loss.replace(",", ".")) || 0));
  const useCalendar = weekdays.length > 0 && hpdNum > 0;

  const workDays = useMemo(
    () => workingDaysOfMonth(year, month, weekdays, excluded),
    [year, month, weekdays, excluded],
  );

  const available = useCalendar
    ? availableHours(workDays.length, hpdNum)
    : parseFloat(manualHours.replace(",", ".")) || 0;
  const productive = productiveHours(available, lossNum);

  const selectedDates = useMemo(() => workDays.map(fromISODay), [workDays]);

  const toggleWeekday = (d: Weekday) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  /** Clicar num dia do calendário alterna feriado/folga daquela data. */
  const handleDayClick = (date: Date) => {
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;
    const iso = toISODay(date);
    // Só faz sentido excluir dias que estariam na jornada.
    if (!weekdays.includes(date.getDay() as Weekday)) return;
    setExcluded((prev) => (prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso]));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      hours: Math.max(1, Math.round(available)),
      rooms: Math.max(1, Math.round(parseFloat(rooms) || 1)),
      tax: parseFloat(tax.replace(",", ".")) || 8.44,
      daysPerWeek: weekdays.length > 0 ? weekdays.length : null,
      hoursPerDay: hpdNum > 0 ? hpdNum : null,
      productiveLossPct: lossNum,
      workWeekdays: weekdays,
      excludedDays: excluded,
    });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Jornada e Configuração
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-4 min-w-0">
            {/* Dias da semana */}
            <div className="space-y-1.5">
              <Label>Dias trabalhados na semana</Label>
              <div className="flex flex-wrap gap-1.5">
                {ORDERED_WEEKDAYS.map((d) => {
                  const active = weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      aria-label={WEEKDAY_FULL[d]}
                      title={WEEKDAY_FULL[d]}
                      onClick={() => toggleWeekday(d)}
                      className={cn(
                        "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="v2-hpd">Horas / dia</Label>
                <Input
                  id="v2-hpd"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hpd}
                  onChange={(e) => setHpd(e.target.value)}
                  placeholder="Ex: 8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v2-loss" className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                  Perda produtiva (%)
                </Label>
                <Input
                  id="v2-loss"
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  value={loss}
                  onChange={(e) => setLoss(e.target.value)}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v2-rooms">Qtd. de salas</Label>
                <Input
                  id="v2-rooms"
                  type="number"
                  min={1}
                  step={1}
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v2-tax">Alíquota IR (%)</Label>
                <Input
                  id="v2-tax"
                  type="number"
                  min={0}
                  step={0.01}
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </div>
            </div>

            {!useCalendar && (
              <div className="space-y-1.5 max-w-[220px]">
                <Label htmlFor="v2-hours">Horas / mês (manual)</Label>
                <Input
                  id="v2-hours"
                  type="number"
                  min={1}
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Marque os dias da semana e informe as horas/dia para calcular pelo calendário.
                </p>
              </div>
            )}

            {/* Resultado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Dias trabalhados · {monthLabel}
                </p>
                <p className="text-lg font-bold font-display">
                  {useCalendar ? workDays.length : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground">Horas disponíveis</p>
                <p className="text-lg font-bold font-display">{formatHours(available)}</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] text-muted-foreground">Horas produtivas</p>
                <p className="text-lg font-bold font-display text-primary">
                  {formatHours(productive)}
                </p>
                {lossNum > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    −{formatHours(Math.round((available - productive) * 100) / 100)} de perda
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O custo/hora, o FMM e a lucratividade usam as <strong>horas produtivas</strong>.
            </p>
          </div>

          {/* Calendário do mês */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Clique num dia para marcar feriado / folga
            </div>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onDayClick={handleDayClick}
              month={new Date(year, month - 1, 1)}
              locale={undefined}
              className={cn("p-3 pointer-events-auto rounded-md border")}
            />
            {excluded.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {excluded.length} dia(s) desmarcado(s)
                </p>
                <Button variant="ghost" size="sm" onClick={() => setExcluded([])}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

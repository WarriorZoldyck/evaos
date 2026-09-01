import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings2, CalendarDays, TrendingDown } from "lucide-react";
import type { SaveConfigInput } from "@/hooks/usePricingV2";
import {
  WorkScheduleModal,
  type WorkScheduleValue,
} from "@/components/precificacao-v2/WorkScheduleModal";
import {
  productiveHours,
  formatHours,
  toMonthKey,
  parseMonthKey,
  type Weekday,
  type WeekdaySchedule,
  type DayOverrides,
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
  weekdaySchedule?: WeekdaySchedule;
  dayOverrides?: DayOverrides;
  observeHolidays?: boolean;
  referenceMonth?: string | null;
  availableHoursMonth?: number;
  workingDays?: number;
  onSave: (input: SaveConfigInput) => Promise<boolean>;
}

export function ConfigCard({
  hoursPerMonth,
  numRooms,
  taxRate,
  daysPerWeek,
  hoursPerDay,
  productiveLossPct = 0,
  workWeekdays = [],
  excludedDays = [],
  weekdaySchedule = {},
  dayOverrides = {},
  observeHolidays = true,
  referenceMonth = null,
  availableHoursMonth,
  workingDays = 0,
  onSave,
}: ConfigCardProps) {
  const [rooms, setRooms] = useState(String(numRooms));
  const [tax, setTax] = useState(String(taxRate));
  const [loss, setLoss] = useState(String(productiveLossPct ?? 0));
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setRooms(String(numRooms));
    setTax(String(taxRate));
    setLoss(String(productiveLossPct ?? 0));
  }, [numRooms, taxRate, productiveLossPct]);

  const today = new Date();
  const monthKey =
    referenceMonth ?? toMonthKey(today.getFullYear(), today.getMonth() + 1);
  const ref = parseMonthKey(monthKey) ?? {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  };
  const monthLabel = new Date(ref.year, ref.month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const lossNum = Math.min(99.99, Math.max(0, parseFloat(loss.replace(",", ".")) || 0));
  const available = availableHoursMonth ?? hoursPerMonth;
  const productive = productiveHours(available, lossNum);

  const baseInput = (): SaveConfigInput => ({
    hours: Math.max(1, Math.round(available)),
    rooms: Math.max(1, Math.round(parseFloat(rooms) || 1)),
    tax: parseFloat(tax.replace(",", ".")) || 8.44,
    daysPerWeek: daysPerWeek ?? null,
    hoursPerDay: hoursPerDay ?? null,
    productiveLossPct: lossNum,
    workWeekdays,
    excludedDays,
  });

  const handleSave = async () => {
    setSaving(true);
    await onSave(baseInput());
    setSaving(false);
  };

  const handleSaveSchedule = async (v: WorkScheduleValue) => {
    await onSave({
      ...baseInput(),
      weekdaySchedule: v.weekdaySchedule,
      dayOverrides: v.dayOverrides,
      observeHolidays: v.observeHolidays,
      referenceMonth: v.referenceMonth,
      workWeekdays: Object.keys(v.weekdaySchedule).map(Number) as Weekday[],
      excludedDays: [],
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Jornada e Configuração
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground capitalize">
              Dias trabalhados · {monthLabel}
            </p>
            <p className="text-lg font-bold font-display">{workingDays || "—"}</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <p className="text-[11px] text-muted-foreground">
          O custo/hora, o FMM e a lucratividade usam as <strong>horas produtivas</strong>.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
            <CalendarDays className="h-4 w-4" /> Editar jornada
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </CardContent>

      {modalOpen && (
        <WorkScheduleModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          productiveLossPct={lossNum}
          value={{
            weekdaySchedule,
            dayOverrides,
            observeHolidays,
            referenceMonth: monthKey,
          }}
          onSave={handleSaveSchedule}
        />
      )}
    </Card>
  );
}

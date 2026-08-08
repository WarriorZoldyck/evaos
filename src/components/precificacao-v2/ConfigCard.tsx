import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

interface ConfigCardProps {
  hoursPerMonth: number;
  numRooms: number;
  taxRate: number;
  daysPerWeek: number | null;
  hoursPerDay: number | null;
  onSave: (hours: number, rooms: number, tax: number, daysPerWeek?: number | null, hoursPerDay?: number | null) => Promise<boolean>;
}

export function ConfigCard({ hoursPerMonth, numRooms, taxRate, daysPerWeek, hoursPerDay, onSave }: ConfigCardProps) {
  const [hours, setHours] = useState(String(hoursPerMonth));
  const [rooms, setRooms] = useState(String(numRooms));
  const [tax, setTax] = useState(String(taxRate));
  const [days, setDays] = useState(daysPerWeek != null ? String(daysPerWeek) : "");
  const [hpd, setHpd] = useState(hoursPerDay != null ? String(hoursPerDay) : "");
  const [saving, setSaving] = useState(false);
  const [autoCalc, setAutoCalc] = useState(false);

  useEffect(() => {
    setHours(String(hoursPerMonth));
    setRooms(String(numRooms));
    setTax(String(taxRate));
    setDays(daysPerWeek != null ? String(daysPerWeek) : "");
    setHpd(hoursPerDay != null ? String(hoursPerDay) : "");
  }, [hoursPerMonth, numRooms, taxRate, daysPerWeek, hoursPerDay]);

  useEffect(() => {
    const d = parseFloat(days);
    const h = parseFloat(hpd);
    if (d > 0 && h > 0) {
      const calc = Math.round(d * h * 4.33);
      setHours(String(calc));
      setAutoCalc(true);
    } else {
      setAutoCalc(false);
    }
  }, [days, hpd]);

  const handleSave = async () => {
    setSaving(true);
    const dVal = parseFloat(days);
    const hVal = parseFloat(hpd);
    await onSave(
      parseInt(hours) || 160,
      Math.max(1, Math.round(parseFloat(rooms) || 1)),
      parseFloat(tax) || 8.44,
      dVal > 0 ? dVal : null,
      hVal > 0 ? hVal : null
    );
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Configuração Geral
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="v2-days">Dias trab. / semana</Label>
            <Input id="v2-days" type="number" min={1} max={7} step={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="Ex: 5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-hpd">Horas / dia</Label>
            <Input id="v2-hpd" type="number" min={0.5} step={0.5} value={hpd} onChange={(e) => setHpd(e.target.value)} placeholder="Ex: 8" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-hours">Horas / mês</Label>
            <Input id="v2-hours" type="number" min={1} value={hours} onChange={(e) => { setHours(e.target.value); setAutoCalc(false); }} className={autoCalc ? "bg-muted" : ""} />
            {autoCalc && <p className="text-[10px] text-muted-foreground">Calculado: {days}d × {hpd}h × 4,33</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-rooms">Qtd. de salas</Label>
            <Input id="v2-rooms" type="number" min={1} step={1} value={rooms} onChange={(e) => setRooms(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-tax">Alíquota IR (%)</Label>
            <Input id="v2-tax" type="number" min={0} step={0.01} value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
  onSave: (hours: number, rooms: number, tax: number) => Promise<boolean>;
}

export function ConfigCard({ hoursPerMonth, numRooms, taxRate, onSave }: ConfigCardProps) {
  const [hours, setHours] = useState(String(hoursPerMonth));
  const [rooms, setRooms] = useState(String(numRooms));
  const [tax, setTax] = useState(String(taxRate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHours(String(hoursPerMonth));
    setRooms(String(numRooms));
    setTax(String(taxRate));
  }, [hoursPerMonth, numRooms, taxRate]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(parseInt(hours) || 160, parseInt(rooms) || 1, parseFloat(tax) || 8.44);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="v2-hours">Horas trabalhadas / mês</Label>
            <Input id="v2-hours" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2-rooms">Quantidade de salas</Label>
            <Input id="v2-rooms" type="number" min={1} value={rooms} onChange={(e) => setRooms(e.target.value)} />
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

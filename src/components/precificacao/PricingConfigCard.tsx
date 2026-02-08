import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, DollarSign, Clock, TrendingUp, Save } from "lucide-react";
import type { PricingConfig, CostSummary } from "@/hooks/usePricing";

interface PricingConfigCardProps {
  config: PricingConfig | null;
  costSummary: CostSummary;
  onSave: (hours: number, margin: number) => Promise<boolean>;
  loading: boolean;
}

export function PricingConfigCard({ config, costSummary, onSave, loading }: PricingConfigCardProps) {
  const [hours, setHours] = useState(160);
  const [margin, setMargin] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setHours(config.hours_per_month);
      setMargin(config.profit_margin);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(hours, margin);
    setSaving(false);
  };

  const fmt = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuração Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="hours" className="text-xs">Horas trabalhadas/mês</Label>
              <Input
                id="hours"
                type="number"
                min={1}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="margin" className="text-xs">Margem de lucro (%)</Label>
              <Input
                id="margin"
                type="number"
                min={0}
                max={100}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas Fixas Clínica</p>
                <p className="text-lg font-bold">{fmt(costSummary.totalFixosClinica)}</p>
                <p className="text-[10px] text-muted-foreground">média mensal (12 meses)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas Pessoais</p>
                <p className="text-lg font-bold">{fmt(costSummary.totalPessoais)}</p>
                <p className="text-[10px] text-muted-foreground">média mensal (12 meses)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo por Hora Clínica</p>
                <p className="text-xl font-bold text-primary">{fmt(costSummary.custoHora)}</p>
                <p className="text-[10px] text-muted-foreground">{hours}h/mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

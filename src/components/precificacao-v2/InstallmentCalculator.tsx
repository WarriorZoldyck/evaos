import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { buildInstallmentPlan } from "@/lib/installmentPricing";
import { formatBRL } from "@/lib/goalPlanning";

const MANUAL = "__manual__";

export function InstallmentCalculator() {
  const { cardTerminals } = useAccounts();

  const [netTarget, setNetTarget] = useState<string>("");
  const [terminalId, setTerminalId] = useState<string>(MANUAL);
  const [acquirerRate, setAcquirerRate] = useState<string>("0");
  const [monthlyInterest, setMonthlyInterest] = useState<string>("1.99");
  const [maxInstallments, setMaxInstallments] = useState<string>("12");

  const handleTerminal = (id: string) => {
    setTerminalId(id);
    if (id === MANUAL) return;
    const t = cardTerminals.find((x) => x.id === id);
    if (t) setAcquirerRate(String(Number(t.credit_rate ?? 0)));
  };

  const rows = useMemo(
    () =>
      buildInstallmentPlan({
        netTarget: Number(netTarget.replace(",", ".")) || 0,
        acquirerRatePercent: Number(acquirerRate.replace(",", ".")) || 0,
        monthlyInterestPercent: Number(monthlyInterest.replace(",", ".")) || 0,
        maxInstallments: Number(maxInstallments) || 1,
      }),
    [netTarget, acquirerRate, monthlyInterest, maxInstallments],
  );

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Calculadora de parcelamento
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Informe quanto você precisa <strong>receber líquido</strong>. A calculadora mostra
        quanto cobrar do cliente em cada parcelamento.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="calc-net" className="text-xs">
            Valor líquido desejado (R$)
          </Label>
          <Input
            id="calc-net"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="1500,00"
            value={netTarget}
            onChange={(e) => setNetTarget(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Maquininha</Label>
          <Select value={terminalId} onValueChange={handleTerminal}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MANUAL}>Taxa manual</SelectItem>
              {cardTerminals.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.credit_rate != null ? ` · ${Number(t.credit_rate)}%` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="calc-rate" className="text-xs">
              Taxa da maquininha (%)
            </Label>
            <Input
              id="calc-rate"
              type="number"
              step="0.01"
              min="0"
              max="99"
              value={acquirerRate}
              onChange={(e) => {
                setAcquirerRate(e.target.value);
                setTerminalId(MANUAL);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-interest" className="text-xs">
              Juro ao mês (%)
            </Label>
            <Input
              id="calc-interest"
              type="number"
              step="0.01"
              min="0"
              value={monthlyInterest}
              onChange={(e) => setMonthlyInterest(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="calc-max" className="text-xs">
            Até quantas parcelas
          </Label>
          <Input
            id="calc-max"
            type="number"
            step="1"
            min="1"
            max="48"
            value={maxInstallments}
            onChange={(e) => setMaxInstallments(e.target.value)}
          />
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Parc.</th>
                <th className="text-right font-medium px-3 py-2">Valor</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
                <th className="text-right font-medium px-3 py-2">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.installments} className="border-t border-border/40">
                  <td className="px-3 py-2 text-foreground">{r.installments}x</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {formatBRL(r.installmentAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {formatBRL(r.totalCharged)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-primary">
                    {formatBRL(r.netReceived)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Informe um valor líquido para ver os parcelamentos.
        </p>
      )}
    </div>
  );
}

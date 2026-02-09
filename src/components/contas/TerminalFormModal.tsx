import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Info } from "lucide-react";

interface RateInfo {
  installments: number;
  rate: number;
}

interface TerminalFormModalProps {
  open: boolean;
  onClose: () => void;
  editData?: any;
  bankAccounts: { id: string; name: string }[];
  onSave: (data: any) => Promise<boolean>;
}

export function TerminalFormModal({
  open,
  onClose,
  editData,
  bankAccounts,
  onSave,
}: TerminalFormModalProps) {
  const [name, setName] = useState("");
  const [acquirer, setAcquirer] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [debitRate, setDebitRate] = useState("");
  const [creditRate, setCreditRate] = useState("");
  const [settlementDaysDebit, setSettlementDaysDebit] = useState("");
  const [settlementDaysCredit, setSettlementDaysCredit] = useState("");
  const [ratesInfo, setRatesInfo] = useState<RateInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setName(editData.name || "");
      setAcquirer(editData.acquirer || "");
      setBankAccountId(editData.bank_account_id || "");
      setUniqueId(editData.unique_id || "");
      setDebitRate(editData.debit_rate != null ? String(editData.debit_rate) : "");
      setCreditRate(editData.credit_rate != null ? String(editData.credit_rate) : "");
      setSettlementDaysDebit(editData.settlement_days_debit != null ? String(editData.settlement_days_debit) : "");
      setSettlementDaysCredit(editData.settlement_days_credit != null ? String(editData.settlement_days_credit) : "");
      try {
        const parsed = editData.rates_info ? JSON.parse(editData.rates_info) : [];
        setRatesInfo(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRatesInfo([]);
      }
    } else {
      setName("");
      setAcquirer("");
      setBankAccountId("");
      setUniqueId("");
      setDebitRate("");
      setCreditRate("");
      setSettlementDaysDebit("");
      setSettlementDaysCredit("");
      setRatesInfo([]);
    }
  }, [editData, open]);

  const addRate = () => setRatesInfo([...ratesInfo, { installments: 2, rate: 0 }]);
  const removeRate = (index: number) => setRatesInfo(ratesInfo.filter((_, i) => i !== index));
  const updateRate = (index: number, field: keyof RateInfo, value: number) => {
    const updated = [...ratesInfo];
    updated[index] = { ...updated[index], [field]: value };
    setRatesInfo(updated);
  };

  const handleSave = async () => {
    if (!name.trim() || !bankAccountId) return;
    setSaving(true);
    const data: any = {
      name: name.trim(),
      acquirer: acquirer.trim() || null,
      bank_account_id: bankAccountId,
      unique_id: uniqueId.trim() || null,
      debit_rate: debitRate ? Number(debitRate) : null,
      credit_rate: creditRate ? Number(creditRate) : null,
      settlement_days_debit: settlementDaysDebit ? Number(settlementDaysDebit) : null,
      settlement_days_credit: settlementDaysCredit ? Number(settlementDaysCredit) : null,
      rates_info: ratesInfo.length > 0 ? JSON.stringify(ratesInfo) : null,
    };
    const success = await onSave(data);
    setSaving(false);
    if (success) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Maquininha" : "Nova Maquininha"}</DialogTitle>
          <DialogDescription>Configure as taxas e prazos de liquidação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="term-name">Nome *</Label>
              <Input id="term-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: REDE" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-acquirer">Adquirente</Label>
              <Input id="term-acquirer" value={acquirer} onChange={(e) => setAcquirer(e.target.value)} placeholder="Ex: REDE, CIELO" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta de Recebimento *</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-serial">Identificação / Serial</Label>
              <Input id="term-serial" value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {/* Settlement days & base rates */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Prazos de Liquidação e Taxas Base</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="term-d-debit">D+ Débito</Label>
                <Input id="term-d-debit" type="number" min="0" value={settlementDaysDebit} onChange={(e) => setSettlementDaysDebit(e.target.value)} placeholder="Ex: 1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term-rate-debit">Taxa Débito (%)</Label>
                <Input id="term-rate-debit" type="number" step="0.01" min="0" value={debitRate} onChange={(e) => setDebitRate(e.target.value)} placeholder="Ex: 0.99" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="term-d-credit">D+ Crédito</Label>
                <Input id="term-d-credit" type="number" min="0" value={settlementDaysCredit} onChange={(e) => setSettlementDaysCredit(e.target.value)} placeholder="Ex: 30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term-rate-credit">Taxa Crédito (%)</Label>
                <Input id="term-rate-credit" type="number" step="0.01" min="0" value={creditRate} onChange={(e) => setCreditRate(e.target.value)} placeholder="Ex: 3.29" />
              </div>
            </div>
          </div>

          {/* Installment rates */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Taxas por Parcelamento</h4>
              <Button type="button" variant="outline" size="sm" onClick={addRate} className="gap-1">
                <Plus className="h-3 w-3" /> Novo Plano
              </Button>
            </div>

            {ratesInfo.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma taxa de parcelamento configurada. A taxa base de crédito será usada.</p>
            )}

            {ratesInfo.map((ri, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="24"
                    value={ri.installments}
                    onChange={(e) => updateRate(i, "installments", Number(e.target.value))}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Taxa (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ri.rate}
                    onChange={(e) => updateRate(i, "rate", Number(e.target.value))}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRate(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Info note */}
          <div className="flex gap-2 items-start rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              A EVA aplicará essas taxas automaticamente ao selecionar esta maquininha no lançamento de receita.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !bankAccountId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editData ? "Salvar" : "Criar Maquininha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

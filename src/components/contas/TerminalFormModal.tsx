import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, CreditCard } from "lucide-react";

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

  const lcdInputClass =
    "bg-transparent border border-cyan-500/40 text-cyan-400 font-mono text-sm placeholder:text-cyan-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 h-8 rounded transition-colors";
  const bodyInputClass =
    "bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/50 h-9 rounded transition-colors";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 border-0 bg-transparent shadow-none overflow-visible [&>button]:hidden">
        <DialogTitle className="sr-only">
          {editData ? "Editar Maquininha" : "Nova Maquininha"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Configure as taxas e prazos de liquidação da maquininha.
        </DialogDescription>

        {/* Terminal body */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#1e3a5f] to-[#2563eb] shadow-2xl shadow-blue-900/50 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Card slot */}
          <div className="h-3 mx-12 mt-0 rounded-b-lg bg-gradient-to-b from-slate-700 to-slate-800 shadow-inner" />

          {/* Header */}
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_2px_rgba(74,222,128,0.5)]" />
            </div>
            <div className="flex-1 min-w-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="NOME DA MAQUININHA"
                className="w-full bg-transparent text-white font-bold text-lg tracking-wide placeholder:text-white/30 border-none outline-none focus:placeholder:text-white/50 transition-colors"
              />
              <input
                value={acquirer}
                onChange={(e) => setAcquirer(e.target.value)}
                placeholder="Adquirente (ex: REDE, CIELO)"
                className="w-full bg-transparent text-blue-200/70 text-xs tracking-wider placeholder:text-white/20 border-none outline-none mt-0.5"
              />
            </div>
            <CreditCard className="h-6 w-6 text-white/30" />
          </div>

          {/* LCD Display */}
          <div className="mx-4 rounded-xl bg-[#0f172a] shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] p-4 space-y-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
              <span className="text-[10px] font-mono text-cyan-600 tracking-[0.2em] uppercase">
                Taxas & Liquidação
              </span>
            </div>

            {/* Debit row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider">
                  D+ Débito
                </label>
                <Input
                  type="number"
                  min="0"
                  value={settlementDaysDebit}
                  onChange={(e) => setSettlementDaysDebit(e.target.value)}
                  placeholder="1"
                  className={lcdInputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider">
                  Taxa Débito %
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={debitRate}
                  onChange={(e) => setDebitRate(e.target.value)}
                  placeholder="0.99"
                  className={lcdInputClass}
                />
              </div>
            </div>

            {/* Credit row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider">
                  D+ Crédito
                </label>
                <Input
                  type="number"
                  min="0"
                  value={settlementDaysCredit}
                  onChange={(e) => setSettlementDaysCredit(e.target.value)}
                  placeholder="30"
                  className={lcdInputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider">
                  Taxa Crédito %
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditRate}
                  onChange={(e) => setCreditRate(e.target.value)}
                  placeholder="3.29"
                  className={lcdInputClass}
                />
              </div>
            </div>
          </div>

          {/* Body fields */}
          <div className="px-5 pt-4 pb-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                Conta de Recebimento
              </label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger className={bodyInputClass + " [&>span]:text-white"}>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                Identificação / Serial
              </label>
              <Input
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                placeholder="Opcional"
                className={bodyInputClass}
              />
            </div>
          </div>

          {/* Installment rates - keypad style */}
          <div className="mx-4 mb-4 rounded-xl bg-black/20 p-4 space-y-3 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                Parcelamento
              </span>
              <button
                type="button"
                onClick={addRate}
                className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-100 transition-colors font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Plano
              </button>
            </div>

            {ratesInfo.length === 0 && (
              <p className="text-[10px] text-white/30 font-mono">
                Nenhuma taxa configurada — taxa base de crédito será usada.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {ratesInfo.map((ri, i) => (
                <div
                  key={i}
                  className="group relative flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="2"
                      max="24"
                      value={ri.installments}
                      onChange={(e) =>
                        updateRate(i, "installments", Number(e.target.value))
                      }
                      className="w-8 bg-transparent text-white font-mono font-bold text-sm text-center border-none outline-none"
                    />
                    <span className="text-white/50 text-xs">x</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ri.rate}
                      onChange={(e) =>
                        updateRate(i, "rate", Number(e.target.value))
                      }
                      className="w-14 bg-transparent text-cyan-300 font-mono text-sm text-center border-none outline-none"
                    />
                    <span className="text-cyan-400/60 text-xs">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRate(i)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-5 pb-5 pt-1 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !bankAccountId}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-400/40"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editData ? "Salvar" : "Criar Maquininha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

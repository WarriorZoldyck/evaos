import { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Trash2, Loader2 } from "lucide-react";

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

const DECORATIVE_KEYS = [
  { label: "1", value: "1" },
  { label: "2", value: "2", sub: "abc" },
  { label: "3", value: "3", sub: "def" },
  { label: "4", value: "4", sub: "ghi" },
  { label: "5", value: "5", sub: "jkl" },
  { label: "6", value: "6", sub: "mno" },
  { label: "7", value: "7", sub: "pqrs" },
  { label: "8", value: "8", sub: "tuv" },
  { label: "9", value: "9", sub: "wxyz" },
  { label: "✱", value: "." },
  { label: "0", value: "0" },
  { label: "⌫", value: "backspace" },
];

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
  const [autoAnticipation, setAutoAnticipation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldSetters: Record<string, [string, (v: string) => void]> = {
    settlementDaysDebit: [settlementDaysDebit, setSettlementDaysDebit],
    debitRate: [debitRate, setDebitRate],
    settlementDaysCredit: [settlementDaysCredit, setSettlementDaysCredit],
    creditRate: [creditRate, setCreditRate],
  };

  useEffect(() => {
    if (!open) return;
    setActiveField(null);
    setErrors({});
    if (editData) {
      setName(editData.name || "");
      setAcquirer(editData.acquirer || "");
      setBankAccountId(editData.bank_account_id || "");
      setUniqueId(editData.unique_id || "");
      setDebitRate(editData.debit_rate != null ? String(editData.debit_rate) : "");
      setCreditRate(editData.credit_rate != null ? String(editData.credit_rate) : "");
      setSettlementDaysDebit(editData.settlement_days_debit != null ? String(editData.settlement_days_debit) : "");
      setSettlementDaysCredit(editData.settlement_days_credit != null ? String(editData.settlement_days_credit) : "");
      setAutoAnticipation(editData.auto_anticipation ?? false);
      try {
        const parsed = editData.rates_info ? JSON.parse(editData.rates_info) : [];
        setRatesInfo(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRatesInfo([]);
      }
    } else {
      setName(""); setAcquirer(""); setBankAccountId(""); setUniqueId("");
      setDebitRate(""); setCreditRate(""); setSettlementDaysDebit("");
      setSettlementDaysCredit(""); setRatesInfo([]); setAutoAnticipation(false);
    }
  }, [editData, open]);

  const addRate = () => setRatesInfo([...ratesInfo, { installments: 2, rate: 0 }]);
  const removeRate = (index: number) => setRatesInfo(ratesInfo.filter((_, i) => i !== index));
  const updateRate = (index: number, field: keyof RateInfo, value: number) => {
    const updated = [...ratesInfo];
    updated[index] = { ...updated[index], [field]: value };
    setRatesInfo(updated);
  };

  const handleKeyPress = useCallback((keyValue: string) => {
    setPressedKey(keyValue);
    setTimeout(() => setPressedKey(null), 150);

    if (!activeField || !fieldSetters[activeField]) return;
    const [current, setter] = fieldSetters[activeField];

    if (keyValue === "backspace") {
      setter(current.slice(0, -1));
    } else if (keyValue === ".") {
      if (!current.includes(".")) setter(current + ".");
    } else {
      setter(current + keyValue);
    }
  }, [activeField, fieldSetters]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Nome é obrigatório";
    if (!bankAccountId) newErrors.bankAccountId = "Conta é obrigatória";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

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
      auto_anticipation: autoAnticipation,
    };
    const success = await onSave(data);
    setSaving(false);
    if (success) onClose();
  };

  const screenInputClass = (field: string) =>
    `bg-white/10 border text-white font-mono text-sm placeholder:text-white/30 focus:ring-1 h-8 rounded-lg transition-all ${
      activeField === field
        ? "border-cyan-300 ring-1 ring-cyan-300/40 bg-white/15"
        : "border-cyan-400/30 focus:border-cyan-300 focus:ring-cyan-300/40"
    }`;
  const bodyInputClass =
    "bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/40 h-9 rounded-lg transition-colors";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[380px] p-0 border-0 bg-transparent shadow-none overflow-visible [&>button]:hidden">
        <DialogTitle className="sr-only">
          {editData ? "Editar Maquininha" : "Nova Maquininha"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Configure as taxas e prazos de liquidação da maquininha.
        </DialogDescription>

        {/* ===== TERMINAL BODY ===== */}
        <div
          className="relative mx-auto w-full max-w-[360px]"
          style={{
            borderRadius: "32px 32px 28px 28px",
            background: "linear-gradient(180deg, #1a3a6c 0%, #2563eb 40%, #1e40af 100%)",
            boxShadow:
              "0 0 0 3px #3b82f6, 0 0 0 5px #1e3a5f, 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.3)",
            padding: "6px",
          }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "28px 28px 24px 24px",
              background: "linear-gradient(180deg, #1a3a6c 0%, #1e3f7a 30%, #2456a8 100%)",
            }}
          >
            {/* Card slot */}
            <div className="flex justify-center pt-2">
              <div
                className="h-[6px] w-28 rounded-b-md"
                style={{
                  background: "linear-gradient(180deg, #0f1f3d, #1a2e55)",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)",
                }}
              />
            </div>

            {/* LED + Brand */}
            <div className="flex items-center gap-2.5 px-5 pt-3 pb-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]" />
              <span className="text-[10px] font-mono text-white/40 tracking-[0.15em] uppercase">
                {acquirer || "Terminal POS"}
              </span>
            </div>

            {/* ===== SCREEN ===== */}
            <div
              className="mx-3 rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #0c1829 0%, #101e33 100%)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(56,189,248,0.2)",
              }}
            >
              <div className="max-h-[340px] overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {/* Name */}
                <div className="space-y-1">
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
                    placeholder="NOME DA MAQUININHA *"
                    className={`w-full bg-transparent text-white font-bold text-base tracking-wide placeholder:text-white/25 border-b outline-none pb-1 transition-colors ${
                      errors.name ? "border-red-400" : "border-transparent"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-[10px] font-mono text-red-400">{errors.name}</p>
                  )}
                </div>

                {/* Acquirer */}
                <input
                  value={acquirer}
                  onChange={(e) => setAcquirer(e.target.value)}
                  placeholder="Adquirente (REDE, CIELO...)"
                  className="w-full bg-transparent text-cyan-200/70 text-xs tracking-wider placeholder:text-white/20 border-none outline-none"
                />

                {/* Rates grid */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-cyan-400/50" />
                    <span className="text-[9px] font-mono text-cyan-500 tracking-[0.2em] uppercase">
                      Taxas & Liquidação
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">D+ Débito</label>
                      <Input type="number" min="0" value={settlementDaysDebit} onChange={(e) => setSettlementDaysDebit(e.target.value)} onFocus={() => setActiveField("settlementDaysDebit")} placeholder="1" className={screenInputClass("settlementDaysDebit")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">Taxa Débito %</label>
                      <Input type="number" step="0.01" min="0" value={debitRate} onChange={(e) => setDebitRate(e.target.value)} onFocus={() => setActiveField("debitRate")} placeholder="0.99" className={screenInputClass("debitRate")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">D+ Crédito</label>
                      <Input type="number" min="0" value={settlementDaysCredit} onChange={(e) => setSettlementDaysCredit(e.target.value)} onFocus={() => setActiveField("settlementDaysCredit")} placeholder="30" className={screenInputClass("settlementDaysCredit")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">Taxa Crédito %</label>
                      <Input type="number" step="0.01" min="0" value={creditRate} onChange={(e) => setCreditRate(e.target.value)} onFocus={() => setActiveField("creditRate")} placeholder="3.29" className={screenInputClass("creditRate")} />
                    </div>
                  </div>
                </div>

                {/* Auto anticipation toggle */}
                <div className="flex items-center justify-between py-1">
                  <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">
                    Antecipação automática?
                  </label>
                  <button
                    type="button"
                    onClick={() => setAutoAnticipation(!autoAnticipation)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoAnticipation ? "bg-cyan-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        autoAnticipation ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {autoAnticipation && (
                  <p className="text-[8px] font-mono text-cyan-300/50">
                    Todas as parcelas serão recebidas no mesmo D+{settlementDaysCredit || "X"}
                  </p>
                )}

                {/* Account select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">
                    Conta de Recebimento <span className="text-red-400">*</span>
                  </label>
                  <Select value={bankAccountId} onValueChange={(v) => { setBankAccountId(v); setErrors((prev) => ({ ...prev, bankAccountId: "" })); }}>
                    <SelectTrigger className={`${bodyInputClass} [&>span]:text-white ${errors.bankAccountId ? "border-red-400 ring-1 ring-red-400/40" : ""}`}>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bankAccountId && (
                    <p className="text-[10px] font-mono text-red-400">{errors.bankAccountId}</p>
                  )}
                </div>

                {/* Serial */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">ID / Serial</label>
                  <Input value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} placeholder="Opcional" className={bodyInputClass} />
                </div>

                {/* Installment rates */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-cyan-500 uppercase tracking-[0.15em]">Parcelamento</span>
                    <button type="button" onClick={addRate} className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-100 transition-colors font-medium">
                      <Plus className="h-3 w-3" /> Novo
                    </button>
                  </div>
                  {ratesInfo.length === 0 && (
                    <p className="text-[9px] text-white/25 font-mono">Taxa base de crédito será usada.</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {ratesInfo.map((ri, i) => (
                      <div key={i} className="group relative flex items-center gap-1.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-lg px-2.5 py-1.5 transition-colors">
                        <input type="number" min="2" max="24" value={ri.installments} onChange={(e) => updateRate(i, "installments", Number(e.target.value))} className="w-7 bg-transparent text-white font-mono font-bold text-xs text-center border-none outline-none" />
                        <span className="text-white/40 text-[10px]">x</span>
                        <input type="number" step="0.01" min="0" value={ri.rate} onChange={(e) => updateRate(i, "rate", Number(e.target.value))} className="w-12 bg-transparent text-cyan-300 font-mono text-xs text-center border-none outline-none" />
                        <span className="text-cyan-400/50 text-[10px]">%</span>
                        <button type="button" onClick={() => removeRate(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== FUNCTIONAL KEYPAD ===== */}
            <div className="px-6 pt-4 pb-2">
              {activeField && (
                <div className="text-center mb-2">
                  <span className="text-[8px] font-mono text-cyan-400/60 uppercase tracking-widest">
                    Editando: {activeField === "settlementDaysDebit" ? "D+ Débito" : activeField === "debitRate" ? "Taxa Débito" : activeField === "settlementDaysCredit" ? "D+ Crédito" : "Taxa Crédito"}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {DECORATIVE_KEYS.map((key) => (
                  <button
                    key={key.label}
                    type="button"
                    onClick={() => handleKeyPress(key.value)}
                    disabled={!activeField}
                    className={`flex flex-col items-center justify-center h-9 rounded-lg select-none transition-all ${
                      !activeField
                        ? "opacity-40 cursor-not-allowed"
                        : "cursor-pointer active:scale-95 hover:bg-white/15"
                    } ${pressedKey === key.value ? "scale-95 bg-white/20" : ""}`}
                    style={{
                      background: pressedKey === key.value
                        ? "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.10) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <span className="text-white/70 text-sm font-semibold leading-none">{key.label}</span>
                    {key.sub && <span className="text-white/30 text-[7px] leading-none mt-0.5">{key.sub}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* ===== ACTION BUTTONS ===== */}
            <div className="px-5 pt-2 pb-5 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={saving}
                className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl text-xs h-10 px-4"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-500 hover:bg-green-400 text-white font-bold shadow-lg shadow-green-500/30 rounded-xl text-xs h-10 px-5 transition-all hover:shadow-green-400/40"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editData ? "Salvar ✓" : "OK ▸▸"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Loader2, RotateCcw } from "lucide-react";

interface CreditCardForm {
  name: string;
  bank_account_id: string;
  closing_day: number;
  due_day: number;
  limit: number;
  last_four_digits?: string;
}

interface CreditCardFormModalProps {
  open: boolean;
  onClose: () => void;
  editData?: any;
  bankAccounts: Array<{ id: string; name: string }>;
  onSave: (data: CreditCardForm) => Promise<boolean>;
}

export function CreditCardFormModal({
  open,
  onClose,
  editData,
  bankAccounts,
  onSave,
}: CreditCardFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [cardName, setCardName] = useState("");
  const [cardDigits, setCardDigits] = useState("");
  const [cardClosing, setCardClosing] = useState("1");
  const [cardDue, setCardDue] = useState("10");
  const [cardLimit, setCardLimit] = useState("0");
  const [cardBankId, setCardBankId] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsFlipped(false);
    if (editData) {
      setCardName(editData.name || "");
      setCardDigits(editData.last_four_digits || "");
      setCardClosing(String(editData.closing_day || 1));
      setCardDue(String(editData.due_day || 10));
      setCardLimit(String(editData.limit || 0));
      setCardBankId(editData.bank_account_id || "");
    } else {
      setCardName("");
      setCardDigits("");
      setCardClosing("1");
      setCardDue("10");
      setCardLimit("0");
      setCardBankId("");
    }
  }, [open, editData]);

  // Auto-flip when digits are complete
  useEffect(() => {
    if (cardDigits.length === 4 && !isFlipped) {
      const timer = setTimeout(() => setIsFlipped(true), 400);
      return () => clearTimeout(timer);
    }
  }, [cardDigits, isFlipped]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const success = await onSave({
      name: cardName.trim(),
      bank_account_id: cardBankId,
      closing_day: Number(cardClosing) || 1,
      due_day: Number(cardDue) || 10,
      limit: Number(cardLimit) || 0,
      last_four_digits: cardDigits.trim() || undefined,
    });
    setSaving(false);
    if (success) onClose();
  };

  const formatDisplayNumber = () => {
    const d = cardDigits.padEnd(4, "•");
    return `•••• •••• •••• ${d}`;
  };

  const formatCurrency = (val: string) => {
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-6 gap-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 3D Card Container */}
          <div className="flex justify-center" style={{ perspective: "1000px" }}>
            <div
              className="relative w-[340px] h-[210px] cursor-pointer transition-transform duration-700"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* FRONT */}
              <div
                className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
                  boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5), 0 0 40px -10px rgba(15,52,96,0.3)",
                }}
              >
                {/* Decorative shine */}
                <div
                  className="absolute top-0 right-0 w-40 h-40 opacity-10 rounded-full"
                  style={{
                    background: "radial-gradient(circle, white 0%, transparent 70%)",
                    transform: "translate(30%, -30%)",
                  }}
                />

                {/* Top row: chip + brand */}
                <div className="flex items-start justify-between relative z-10">
                  {/* Chip */}
                  <div
                    className="w-11 h-8 rounded-md"
                    style={{
                      background: "linear-gradient(135deg, #d4a574 0%, #f0d48a 30%, #c9a050 60%, #d4a574 100%)",
                      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-px p-1 opacity-40">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-[1px] bg-amber-800/40" />
                      ))}
                    </div>
                  </div>
                  {/* Contactless icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/50">
                    <path d="M12 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 10c1.1 0 2 .9 2 2s-.9 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Card number */}
                <p
                  className="text-lg tracking-[0.2em] font-mono relative z-10"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {formatDisplayNumber()}
                </p>

                {/* Bottom row: name + brand */}
                <div className="flex items-end justify-between relative z-10">
                  <p
                    className="text-sm uppercase tracking-wider truncate max-w-[200px]"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {cardName || "SEU NOME AQUI"}
                  </p>
                  {/* Brand circles (Mastercard-style) */}
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-red-500/80" />
                    <div className="w-7 h-7 rounded-full bg-yellow-500/60" />
                  </div>
                </div>
              </div>

              {/* BACK */}
              <div
                className="absolute inset-0 rounded-2xl flex flex-col overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
                  boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5), 0 0 40px -10px rgba(15,52,96,0.3)",
                }}
              >
                {/* Magnetic stripe */}
                <div className="w-full h-10 mt-5 bg-black/70" />

                {/* Info area */}
                <div className="flex-1 px-5 py-3 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Fechamento
                      </span>
                      <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                        Dia {cardClosing || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Vencimento
                      </span>
                      <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                        Dia {cardDue || "—"}
                      </p>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Limite
                      </span>
                      <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                        {formatCurrency(cardLimit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider truncate max-w-[180px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {bankAccounts.find((a) => a.id === cardBankId)?.name || "Conta vinculada"}
                    </span>
                    <div className="flex -space-x-2">
                      <div className="w-5 h-5 rounded-full bg-red-500/60" />
                      <div className="w-5 h-5 rounded-full bg-yellow-500/40" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Flip hint */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              {isFlipped ? "Ver frente" : "Ver verso"}
            </button>
          </div>

          {/* Form fields based on side */}
          {!isFlipped ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome do Cartão *</Label>
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Ex: Nubank Platinum"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Últimos 4 dígitos</Label>
                <Input
                  maxLength={4}
                  value={cardDigits}
                  onChange={(e) => setCardDigits(e.target.value.replace(/\D/g, ""))}
                  placeholder="0000"
                  inputMode="numeric"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Dia Fechamento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={cardClosing}
                    onChange={(e) => setCardClosing(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dia Vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={cardDue}
                    onChange={(e) => setCardDue(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Limite (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Conta Bancária Vinculada *</Label>
                <Select value={cardBankId} onValueChange={setCardBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

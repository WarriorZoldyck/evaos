import { useState, useEffect, useRef } from "react";
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
import { Loader2 } from "lucide-react";
import { CreditCard3D } from "./CreditCard3D";

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg p-6 gap-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <CreditCard3D
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            cardName={cardName}
            cardDigits={cardDigits}
            cardClosing={cardClosing}
            cardDue={cardDue}
            cardLimit={cardLimit}
            bankAccountName={bankAccounts.find((a) => a.id === cardBankId)?.name}
          />

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

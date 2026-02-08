import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

type AccountTab = "bank" | "card" | "wallet";

interface BankAccountForm {
  name: string;
  type: string;
  initial_balance: number;
  account_number?: string;
  agency_number?: string;
}

interface CreditCardForm {
  name: string;
  bank_account_id: string;
  closing_day: number;
  due_day: number;
  limit: number;
  last_four_digits?: string;
}

interface WalletForm {
  name: string;
  initial_balance: number;
}

interface AccountFormModalProps {
  open: boolean;
  onClose: () => void;
  tab: AccountTab;
  editData?: any;
  bankAccounts: Array<{ id: string; name: string }>;
  onSaveBankAccount: (data: BankAccountForm) => Promise<boolean>;
  onSaveCreditCard: (data: CreditCardForm) => Promise<boolean>;
  onSaveWallet: (data: WalletForm) => Promise<boolean>;
}

export function AccountFormModal({
  open,
  onClose,
  tab,
  editData,
  bankAccounts,
  onSaveBankAccount,
  onSaveCreditCard,
  onSaveWallet,
}: AccountFormModalProps) {
  const [saving, setSaving] = useState(false);

  // Bank account fields
  const [bankName, setBankName] = useState("");
  const [bankType, setBankType] = useState("Conta Corrente");
  const [bankBalance, setBankBalance] = useState("0");
  const [bankAccountNum, setBankAccountNum] = useState("");
  const [bankAgency, setBankAgency] = useState("");

  // Credit card fields
  const [cardName, setCardName] = useState("");
  const [cardBankId, setCardBankId] = useState("");
  const [cardClosing, setCardClosing] = useState("1");
  const [cardDue, setCardDue] = useState("10");
  const [cardLimit, setCardLimit] = useState("0");
  const [cardDigits, setCardDigits] = useState("");

  // Wallet fields
  const [walletName, setWalletName] = useState("");
  const [walletBalance, setWalletBalance] = useState("0");

  useEffect(() => {
    if (!open) return;
    if (editData && tab === "bank") {
      setBankName(editData.name || "");
      setBankType(editData.type || "Conta Corrente");
      setBankBalance(String(editData.initial_balance || 0));
      setBankAccountNum(editData.account_number || "");
      setBankAgency(editData.agency_number || "");
    } else if (editData && tab === "card") {
      setCardName(editData.name || "");
      setCardBankId(editData.bank_account_id || "");
      setCardClosing(String(editData.closing_day || 1));
      setCardDue(String(editData.due_day || 10));
      setCardLimit(String(editData.limit || 0));
      setCardDigits(editData.last_four_digits || "");
    } else if (editData && tab === "wallet") {
      setWalletName(editData.name || "");
      setWalletBalance(String(editData.initial_balance || 0));
    } else {
      // Reset all
      setBankName(""); setBankType("Conta Corrente"); setBankBalance("0");
      setBankAccountNum(""); setBankAgency("");
      setCardName(""); setCardBankId(""); setCardClosing("1");
      setCardDue("10"); setCardLimit("0"); setCardDigits("");
      setWalletName(""); setWalletBalance("0");
    }
  }, [open, editData, tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let success = false;

    if (tab === "bank") {
      success = await onSaveBankAccount({
        name: bankName.trim(),
        type: bankType,
        initial_balance: Number(bankBalance) || 0,
        account_number: bankAccountNum.trim() || undefined,
        agency_number: bankAgency.trim() || undefined,
      });
    } else if (tab === "card") {
      success = await onSaveCreditCard({
        name: cardName.trim(),
        bank_account_id: cardBankId,
        closing_day: Number(cardClosing) || 1,
        due_day: Number(cardDue) || 10,
        limit: Number(cardLimit) || 0,
        last_four_digits: cardDigits.trim() || undefined,
      });
    } else {
      success = await onSaveWallet({
        name: walletName.trim(),
        initial_balance: Number(walletBalance) || 0,
      });
    }

    setSaving(false);
    if (success) onClose();
  };

  const titles: Record<AccountTab, string> = {
    bank: editData ? "Editar Conta Bancária" : "Nova Conta Bancária",
    card: editData ? "Editar Cartão de Crédito" : "Novo Cartão de Crédito",
    wallet: editData ? "Editar Carteira" : "Nova Carteira",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[tab]}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "bank" && (
            <>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex: Nubank, Itaú" required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={bankType} onValueChange={setBankType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                    <SelectItem value="Poupança">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="0000" />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input value={bankAccountNum} onChange={(e) => setBankAccountNum(e.target.value)} placeholder="00000-0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial (R$)</Label>
                <Input type="number" step="0.01" value={bankBalance} onChange={(e) => setBankBalance(e.target.value)} />
              </div>
            </>
          )}

          {tab === "card" && (
            <>
              <div className="space-y-2">
                <Label>Nome do Cartão *</Label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank Platinum" required />
              </div>
              <div className="space-y-2">
                <Label>Conta Bancária Vinculada *</Label>
                <Select value={cardBankId} onValueChange={setCardBankId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Dia Fechamento</Label>
                  <Input type="number" min={1} max={31} value={cardClosing} onChange={(e) => setCardClosing(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Dia Vencimento</Label>
                  <Input type="number" min={1} max={31} value={cardDue} onChange={(e) => setCardDue(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Limite (R$)</Label>
                  <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>4 últimos dígitos</Label>
                  <Input maxLength={4} value={cardDigits} onChange={(e) => setCardDigits(e.target.value)} placeholder="0000" />
                </div>
              </div>
            </>
          )}

          {tab === "wallet" && (
            <>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="Ex: Caixa, Cofre" required />
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial (R$)</Label>
                <Input type="number" step="0.01" value={walletBalance} onChange={(e) => setWalletBalance(e.target.value)} />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
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

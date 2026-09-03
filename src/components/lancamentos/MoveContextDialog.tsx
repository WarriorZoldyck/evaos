import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Transaction } from "@/hooks/useTransactions";
import type { Company } from "@/contexts/CompanyContext";

interface AccountRef {
  id: string;
  name: string;
  company_id: string | null;
}

interface MoveContextDialogProps {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  allAccounts: {
    bankAccounts: AccountRef[];
    wallets: AccountRef[];
    creditCards: AccountRef[];
  };
  companies: Company[];
  onConfirm: (ids: string[], companyId: string | null) => Promise<unknown>;
}

const PERSONAL = "__personal__";

export function MoveContextDialog({
  open,
  onClose,
  transactions,
  allAccounts,
  companies,
  onConfirm,
}: MoveContextDialogProps) {
  const [target, setTarget] = useState<string>(PERSONAL);
  const [saving, setSaving] = useState(false);

  const targetCompanyId = target === PERSONAL ? null : target;

  // Each transaction inherits its context from the linked account/wallet/card
  // (enforced by a database trigger), so moving it is only possible when that
  // origin already belongs to the target context — or when there is none.
  const analysis = useMemo(() => {
    const bank = new Map(allAccounts.bankAccounts.map((a) => [a.id, a]));
    const wallet = new Map(allAccounts.wallets.map((a) => [a.id, a]));
    const card = new Map(allAccounts.creditCards.map((a) => [a.id, a]));

    const movable: Transaction[] = [];
    const blocked: { tx: Transaction; origin: string }[] = [];

    for (const t of transactions) {
      let origin: AccountRef | undefined;
      if (t.bank_account_id) origin = bank.get(t.bank_account_id);
      else if (t.wallet_id) origin = wallet.get(t.wallet_id);
      else if (t.credit_card_id) origin = card.get(t.credit_card_id);

      if (!origin || origin.company_id === targetCompanyId) movable.push(t);
      else blocked.push({ tx: t, origin: origin.name });
    }
    return { movable, blocked };
  }, [transactions, allAccounts, targetCompanyId]);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(analysis.movable.map((t) => t.id), targetCompanyId);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para outro contexto</DialogTitle>
          <DialogDescription>
            {transactions.length} lançamento{transactions.length > 1 ? "s" : ""} selecionado
            {transactions.length > 1 ? "s" : ""}. Escolha o contexto de destino.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={target} onValueChange={setTarget} className="gap-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value={PERSONAL} id="ctx-personal" />
            <Label htmlFor="ctx-personal" className="cursor-pointer">Pessoal</Label>
          </div>
          {companies.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <RadioGroupItem value={c.id} id={`ctx-${c.id}`} />
              <Label htmlFor={`ctx-${c.id}`} className="cursor-pointer">{c.name}</Label>
            </div>
          ))}
        </RadioGroup>

        {analysis.blocked.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {analysis.blocked.length} lançamento{analysis.blocked.length > 1 ? "s" : ""} não pode
              {analysis.blocked.length > 1 ? "m" : ""} ser movido{analysis.blocked.length > 1 ? "s" : ""}
            </AlertTitle>
            <AlertDescription>
              <p className="mb-2 text-xs">
                A conta, carteira ou cartão vinculado pertence a outro contexto. Troque o vínculo no
                lançamento (ou mude o contexto da conta) antes de mover.
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                {analysis.blocked.slice(0, 12).map(({ tx, origin }) => (
                  <li key={tx.id}>• {tx.description} — {origin}</li>
                ))}
                {analysis.blocked.length > 12 && <li>• … e mais {analysis.blocked.length - 12}</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || analysis.movable.length === 0}>
            Mover {analysis.movable.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard3D } from "@/components/contas/CreditCard3D";
import { useAccounts } from "@/hooks/useAccounts";

interface Tx {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  credit_card_id?: string | null;
}

interface Props {
  allTransactions: Tx[];
  loading: boolean;
}

export function DashboardCreditCardsRow({ allTransactions, loading }: Props) {
  const navigate = useNavigate();
  const { creditCards, bankAccounts } = useAccounts();
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  // Open bill = sum of all PENDING transactions for the card (despesa - receita)
  const usedByCard = useMemo(() => {
    const m = new Map<string, number>();
    allTransactions.forEach((t) => {
      if (!t.credit_card_id) return;
      if (t.status !== "Pendente") return;
      const cur = m.get(t.credit_card_id) || 0;
      const signed =
        t.type === "despesa" ? Number(t.amount) : -Number(t.amount);
      m.set(t.credit_card_id, cur + signed);
    });
    return m;
  }, [allTransactions]);

  if (loading) {
    return (
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4 text-primary" />
            Cartões de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[210px] w-[340px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (creditCards.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-premium">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4 text-primary" />
          Cartões de Crédito
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => navigate("/contas")}
        >
          Ver todos
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory">
          {creditCards.map((c) => {
            const bankName = bankAccounts.find((b) => b.id === c.bank_account_id)?.name;
            const parentName = (c as any).parent_card_id
              ? creditCards.find((p) => p.id === (c as any).parent_card_id)?.name
              : undefined;
            const used = Math.max(0, usedByCard.get(c.id) || 0);
            return (
              <div key={c.id} className="shrink-0 snap-start">
                <CreditCard3D
                  isFlipped={!!flipped[c.id]}
                  onFlip={() =>
                    setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))
                  }
                  cardName={c.name}
                  cardDigits={c.last_four_digits || ""}
                  cardClosing={String(c.closing_day)}
                  cardDue={String(c.due_day)}
                  cardLimit={String(c.limit ?? 0)}
                  bankAccountName={bankName}
                  usedAmount={used}
                  parentCardName={parentName}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

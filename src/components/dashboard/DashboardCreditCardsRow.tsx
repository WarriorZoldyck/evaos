import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard3D } from "@/components/contas/CreditCard3D";
import { CreditCardBillPaymentModal } from "@/components/contas/CreditCardBillPaymentModal";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreditCardCycleTotals } from "@/hooks/useCreditCardCycleTotals";

interface Props {
  loading: boolean;
}

type CycleOffset = -1 | 0 | 1;

const OFFSET_LABEL: Record<CycleOffset, string> = {
  [-1]: "Fatura anterior",
  [0]: "Fatura atual",
  [1]: "Próxima fatura",
};

function cycleKeyFromOffset(offset: CycleOffset): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cycleDateFromOffset(offset: CycleOffset): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d;
}

export function DashboardCreditCardsRow({ loading }: Props) {
  const navigate = useNavigate();
  const { creditCards, bankAccounts } = useAccounts();
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [cycleOffsetByCard, setCycleOffsetByCard] = useState<Record<string, CycleOffset>>({});
  const [billModal, setBillModal] = useState<{ cardId: string; refDate: Date } | null>(null);

  const cardIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);
  const { totals: usedByCardCycle, refetch: refetchTotals } = useCreditCardCycleTotals(cardIds);


  const modalCard = useMemo(() => {
    if (!billModal) return null;
    const c = creditCards.find((cc) => cc.id === billModal.cardId);
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      last_four_digits: c.last_four_digits ?? null,
      closing_day: c.closing_day,
      due_day: c.due_day,
      bank_account_id: c.bank_account_id ?? "",
      limit: Number(c.limit ?? 0),
    };
  }, [billModal, creditCards]);

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
    <>
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
              const offset: CycleOffset = cycleOffsetByCard[c.id] ?? 0;
              const cycleKey = cycleKeyFromOffset(offset);
              const rawTotal = usedByCardCycle.get(c.id)?.get(cycleKey) || 0;
              const used = Math.max(0, rawTotal);
              const cycleDate = cycleDateFromOffset(offset);
              const monthLabel = format(cycleDate, "MMM/yy", { locale: ptBR });
              const cycleLabel = `${OFFSET_LABEL[offset]} · ${monthLabel}`;

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
                    cycleLabel={cycleLabel}
                    canPrev={offset > -1}
                    canNext={offset < 1}
                    onPrevCycle={() =>
                      setCycleOffsetByCard((prev) => ({
                        ...prev,
                        [c.id]: Math.max(-1, offset - 1) as CycleOffset,
                      }))
                    }
                    onNextCycle={() =>
                      setCycleOffsetByCard((prev) => ({
                        ...prev,
                        [c.id]: Math.min(1, offset + 1) as CycleOffset,
                      }))
                    }
                    onOpenBill={() =>
                      setBillModal({ cardId: c.id, refDate: cycleDate })
                    }
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CreditCardBillPaymentModal
        open={!!billModal && !!modalCard}
        creditCard={modalCard}
        initialReferenceDate={billModal?.refDate ?? null}
        onClose={() => setBillModal(null)}
        onSuccess={() => { setBillModal(null); refetchTotals(); }}
      />
    </>
  );
}

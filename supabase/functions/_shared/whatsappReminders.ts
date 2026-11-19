export interface TargetDateInfo {
  days: number;
  dateStr: string;
}

export interface CardInvoiceReminder {
  cardId: string;
  cardName: string;
  payment_date: string;
  totalAmount: number;
  count: number;
}

export interface BillReminder {
  description: string;
  amount: number;
  payment_date: string;
  isRecurring?: boolean;
}

export interface CollectedReminders {
  invoices: CardInvoiceReminder[];
  bills: BillReminder[];
  totalItems: number;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function dayLabelText(daysLeft: number | null): string {
  if (daysLeft === 0) return "VENCE HOJE";
  if (daysLeft === 1) return "VENCE AMANHÃ";
  return `Vence em ${daysLeft} dias`;
}

function dayLabelBadge(daysLeft: number | null): string {
  if (daysLeft === 0) return "🚨 *(VENCE HOJE)*";
  if (daysLeft === 1) return "⚠️ *(VENCE AMANHÃ)*";
  return `📅 *(Vence em ${daysLeft} dias)*`;
}

export async function collectUserReminders(
  supabase: any,
  userId: string,
  targetDatesInfo: TargetDateInfo[],
): Promise<CollectedReminders> {
  const targetDates = targetDatesInfo.map((t) => t.dateStr);

  const [cardsRes, txRes, recRes] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("id, name, parent_card_id")
      .eq("user_id", userId),
    supabase
      .from("transactions")
      .select("id, description, amount, payment_date, credit_card_id, type")
      .eq("user_id", userId)
      .eq("status", "Pendente")
      .in("payment_date", targetDates)
      .order("payment_date", { ascending: true }),
    supabase
      .from("recurring_transactions")
      .select("id, description, amount, type, frequency, start_date, end_date, day_of_month, credit_card_id")
      .eq("user_id", userId)
      .eq("type", "despesa"),
  ]);

  if (txRes.error) {
    throw new Error("Erro ao buscar lançamentos: " + txRes.error.message);
  }

  const cardById = new Map<string, { id: string; name: string; parent_card_id: string | null }>();
  (cardsRes.data || []).forEach((c: any) => cardById.set(c.id, c));

  const getRootCard = (cardId: string): { id: string; name: string } => {
    let cur = cardById.get(cardId);
    let guard = 0;
    while (cur?.parent_card_id && cardById.has(cur.parent_card_id) && guard < 5) {
      cur = cardById.get(cur.parent_card_id)!;
      guard++;
    }
    return cur
      ? { id: cur.id, name: cur.name }
      : { id: cardId, name: "Cartão de Crédito" };
  };

  const invoiceMap = new Map<string, CardInvoiceReminder>();
  const bills: BillReminder[] = [];

  const addCardItem = (cardId: string, paymentDate: string, signedAmount: number) => {
    const root = getRootCard(cardId);
    const key = `${root.id}::${paymentDate}`;
    const existing = invoiceMap.get(key) || {
      cardId: root.id,
      cardName: root.name,
      payment_date: paymentDate,
      totalAmount: 0,
      count: 0,
    };
    existing.totalAmount += signedAmount;
    existing.count += 1;
    invoiceMap.set(key, existing);
  };

  for (const tx of txRes.data || []) {
    const amt = Math.abs(Number(tx.amount) || 0);
    if (tx.credit_card_id) {
      // Despesas somam e estornos/créditos (receita no cartão) abatem da fatura
      const signed = tx.type === "receita" ? -amt : amt;
      addCardItem(tx.credit_card_id, tx.payment_date, signed);
    } else if (tx.type === "despesa") {
      bills.push({
        description: tx.description,
        amount: amt,
        payment_date: tx.payment_date,
      });
    }
  }

  // Despesas recorrentes (evita duplicar lançamentos já existentes na mesma data)
  for (const rec of recRes.data || []) {
    for (const target of targetDatesInfo) {
      const tDate = new Date(target.dateStr + "T00:00:00");
      const sDate = new Date(rec.start_date + "T00:00:00");
      if (tDate < sDate) continue;
      if (rec.end_date) {
        const eDate = new Date(rec.end_date + "T00:00:00");
        if (tDate > eDate) continue;
      }

      let matches = false;
      if (rec.frequency === "monthly") {
        const targetDay = rec.day_of_month || sDate.getDate();
        const daysInMonth = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0).getDate();
        if (tDate.getDate() === Math.min(targetDay, daysInMonth)) {
          matches = true;
        }
      } else if (rec.frequency === "daily") {
        matches = true;
      } else if (rec.frequency === "weekly") {
        matches = (tDate.getTime() - sDate.getTime()) % (7 * 86400000) === 0;
      }

      if (!matches) continue;

      if (rec.credit_card_id) {
        // Só adiciona se ainda não houver lançamento materializado com a mesma descrição na data
        const alreadyMaterialized = (txRes.data || []).some(
          (tx: any) =>
            tx.payment_date === target.dateStr &&
            tx.credit_card_id === rec.credit_card_id &&
            String(tx.description || "").toLowerCase().trim() === String(rec.description || "").toLowerCase().trim(),
        );
        if (!alreadyMaterialized) {
          addCardItem(rec.credit_card_id, target.dateStr, Math.abs(Number(rec.amount) || 0));
        }
      } else {
        const alreadyExists = bills.some(
          (b) =>
            b.payment_date === target.dateStr &&
            b.description.toLowerCase().trim() === String(rec.description || "").toLowerCase().trim(),
        );
        if (!alreadyExists) {
          bills.push({
            description: rec.description,
            amount: Math.abs(Number(rec.amount) || 0),
            payment_date: target.dateStr,
            isRecurring: true,
          });
        }
      }
    }
  }

  const invoices = Array.from(invoiceMap.values())
    .map((inv) => ({ ...inv, totalAmount: Math.round(inv.totalAmount * 100) / 100 }))
    .filter((inv) => inv.totalAmount > 0)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.cardName.localeCompare(b.cardName));

  bills.sort((a, b) => a.payment_date.localeCompare(b.payment_date));

  return {
    invoices,
    bills,
    totalItems: invoices.length + bills.length,
  };
}

export function formatReminderMessage(
  firstName: string,
  collected: CollectedReminders,
  targetDatesInfo: TargetDateInfo[],
  options: { isTest?: boolean; daysBeforeArr?: number[]; configuredTime?: string } = {},
): string {
  const headerTag = options.isTest ? " *(Teste de Lembrete)*" : "";
  let message = `Olá, ${firstName}! 👋${headerTag}\n\n`;

  if (collected.totalItems === 0) {
    const daysText = (options.daysBeforeArr || [0, 1, 3])
      .map((d) => (d === 0 ? "no dia" : `${d}d antes`))
      .join(", ");
    message += `Tudo certo por aqui! Você não possui despesas pendentes com vencimento nos dias configurados no seu lembrete (${daysText}). 🚀\n\nQuando houver contas a vencer, a EVA enviará o resumo para você automaticamente no horário configurado (${options.configuredTime || "09:00"})!`;
    return message;
  }

  message += options.isTest
    ? `Você tem as seguintes contas próximas do vencimento:\n\n`
    : `Passando para te lembrar das suas próximas contas a vencer:\n\n`;

  for (const inv of collected.invoices) {
    const match = targetDatesInfo.find((t) => t.dateStr === inv.payment_date);
    const daysLeft = match ? match.days : null;
    const countLabel = inv.count === 1 ? "1 lançamento" : `${inv.count} lançamentos`;
    message += `💳 *Fatura ${inv.cardName}* — ${formatBRL(inv.totalAmount)} — Vencimento ${formatDateBR(inv.payment_date)} (${dayLabelText(daysLeft)}) — ${countLabel}\n`;
  }

  if (collected.invoices.length > 0 && collected.bills.length > 0) {
    message += `\n`;
  }

  for (const bill of collected.bills) {
    const match = targetDatesInfo.find((t) => t.dateStr === bill.payment_date);
    const daysLeft = match ? match.days : null;
    message += `💸 *${bill.description}*\n`;
    message += `💰 Valor: ${formatBRL(bill.amount)}\n`;
    message += `🗓️ Vencimento: ${formatDateBR(bill.payment_date)} ${dayLabelBadge(daysLeft)}\n\n`;
  }

  if (collected.invoices.length > 0) {
    if (collected.bills.length === 0) message += `\n`;
    message += `Quer ver os itens de alguma fatura? É só me pedir: *detalhar fatura ${collected.invoices[0].cardName}*.\n\n`;
  }

  message += `💡 Acesse o EVA OS para conferir ou liquidar seus lançamentos!`;
  return message;
}

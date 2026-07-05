export type PaymentKind =
  | "credito"
  | "debito"
  | "boleto"
  | "pix"
  | "dinheiro"
  | "transferencia"
  | "outros";

export const CARD_KINDS: PaymentKind[] = ["credito", "debito"];

export const KIND_LABEL: Record<PaymentKind, string> = {
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outros: "Outros",
};

export function normalizePM(pm?: string | null): string {
  return (pm ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

export interface ClassifiableTx {
  payment_method?: string | null;
  card_terminal_id?: string | null;
}

export function classifyPayment(t: ClassifiableTx): PaymentKind {
  const pm = normalizePM(t.payment_method);
  if (["debito", "cartaodebito", "debitcard"].includes(pm)) return "debito";
  if (["credito", "cartaocredito", "creditcard", "cartao"].includes(pm)) return "credito";
  if (t.card_terminal_id) return "credito";
  if (pm.includes("boleto")) return "boleto";
  if (pm.includes("pix")) return "pix";
  if (pm.includes("dinheiro") || pm === "cash" || pm.includes("especie")) return "dinheiro";
  if (pm.includes("transferencia") || pm === "ted" || pm === "doc") return "transferencia";
  return "outros";
}

export function isCardPayment(t: ClassifiableTx): boolean {
  return CARD_KINDS.includes(classifyPayment(t));
}

/**
 * Bruto per-item: if it's a card payment and original_amount > amount,
 * use original_amount (gross before MDR). Otherwise use amount.
 */
export function itemGross(t: ClassifiableTx & { amount: number | string; original_amount?: number | null }): number {
  const amt = Number(t.amount) || 0;
  const oa = Number(t.original_amount) || 0;
  return isCardPayment(t) && oa > amt ? oa : amt;
}

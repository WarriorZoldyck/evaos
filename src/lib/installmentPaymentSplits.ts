export interface InstallmentSplitPart {
  method: string;
  /** "bank:<id>" | "wallet:<id>" | "card:<id>" | "terminal:<id>" | "" */
  account: string;
  amount: number;
  status?: "Pendente" | "Pago";
}

export const AVAILABLE_PAYMENT_MODALITIES = [
  { id: "PIX", label: "PIX", icon: "⚡" },
  { id: "Cartão de Crédito", label: "Cartão de Crédito", icon: "💳" },
  { id: "Boleto", label: "Boleto", icon: "📄" },
  { id: "Dinheiro", label: "Dinheiro", icon: "💵" },
  { id: "Cartão de Débito", label: "Cartão de Débito", icon: "💳" },
  { id: "Transferência", label: "Transferência", icon: "🏦" },
  { id: "Cheque", label: "Cheque", icon: "📝" },
  { id: "Outro", label: "Outro", icon: "➕" },
] as const;

export const FLEXIBLE_PAYMENT_METHODS = [
  "PIX",
  "Dinheiro",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Boleto",
  "Transferência",
  "Cheque",
  "Depósito",
  "Débito Automático",
  "Outro",
] as const;

const toCents = (v: number) => Math.round((Number(v) || 0) * 100);

export function installmentSplitsRemaining(
  installmentAmount: number,
  parts: InstallmentSplitPart[],
): number {
  const used = parts.reduce((sum, p) => sum + toCents(p.amount), 0);
  return (toCents(installmentAmount) - used) / 100;
}

export function validateInstallmentSplits(
  installmentAmount: number,
  parts: InstallmentSplitPart[],
): string | null {
  if (!parts.length) return "Adicione ao menos uma forma de pagamento.";
  for (const p of parts) {
    if (!p.method) return "Selecione a forma de pagamento de cada parte.";
    if (toCents(p.amount) <= 0) return "Cada parte precisa ter valor maior que zero.";
    const acc = parseFlexibleAccount(p.account || "");
    const isCard = p.method === "Cartão de Crédito" || p.method === "Cartão de Débito";
    if (isCard && acc.card_terminal_id) continue;
    if (p.method === "Dinheiro" && !acc.wallet_id) return "Selecione a carteira da parte em Dinheiro.";
    if (p.method === "Cartão de Crédito" && !acc.credit_card_id && !acc.bank_account_id) return "Escolha a maquininha do cartão.";
    if (!acc.bank_account_id && !acc.wallet_id && !acc.credit_card_id) return `Selecione a conta da parte em ${p.method}.`;
  }
  const rem = installmentSplitsRemaining(installmentAmount, parts);
  if (rem !== 0) {
    return `A soma das formas (${((toCents(installmentAmount) - toCents(rem)) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) difere do valor da parcela.`;
  }
  return null;
}

export function parseFlexibleAccount(account: string): {
  bank_account_id: string | null;
  wallet_id: string | null;
  credit_card_id: string | null;
  card_terminal_id?: string | null;
} {
  if (account.startsWith("terminal:")) {
    return { bank_account_id: null, wallet_id: null, credit_card_id: null, card_terminal_id: account.slice(9) };
  }
  if (account.startsWith("bank:")) {
    return { bank_account_id: account.slice(5), wallet_id: null, credit_card_id: null };
  }
  if (account.startsWith("wallet:")) {
    return { bank_account_id: null, wallet_id: account.slice(7), credit_card_id: null };
  }
  if (account.startsWith("card:")) {
    return { bank_account_id: null, wallet_id: null, credit_card_id: account.slice(5) };
  }
  return { bank_account_id: null, wallet_id: null, credit_card_id: null };
}


export interface TerminalRateSource {
  debit_rate: number | null;
  credit_rate: number | null;
  settlement_days_debit: number | null;
  settlement_days_credit: number | null;
  rates_info: string | null;
}

/** Taxa MDR aplicável à parte do cartão, conforme nº de parcelas no cartão. */
export function terminalRateFor(terminal: TerminalRateSource, method: string, cardCount: number): { rate: number; settlementDays: number } {
  if (method === "Cartão de Débito") {
    return { rate: terminal.debit_rate ?? 0, settlementDays: terminal.settlement_days_debit ?? 1 };
  }
  let rate = terminal.credit_rate ?? 0;
  if (cardCount >= 2 && terminal.rates_info) {
    try {
      const arr = JSON.parse(terminal.rates_info);
      const m = Array.isArray(arr) ? arr.find((r: { installments: number }) => r.installments === cardCount) : null;
      if (m) rate = m.rate;
    } catch { /* ignore */ }
  }
  return { rate, settlementDays: terminal.settlement_days_credit ?? 2 };
}

/**
 * Recebível de uma parcela do cartão via maquininha.
 * indexInCard é 0-based dentro da parte do cartão.
 * Sem antecipação (D+30 ou mais): cada parcela cai N meses após a venda.
 * Com antecipação (< 30 dias): todas caem em venda + D dias.
 */
export function terminalReceivable(params: {
  terminal: TerminalRateSource;
  method: string;
  gross: number;
  cardCount: number;
  indexInCard: number;
  saleDate: Date;
}): { rate: number; fee: number; net: number; paymentDate: Date } {
  const { rate, settlementDays } = terminalRateFor(params.terminal, params.method, params.cardCount);
  const fee = Math.round(params.gross * (rate / 100) * 100) / 100;
  const net = Math.round((params.gross - fee) * 100) / 100;
  const d = new Date(params.saleDate);
  if (params.method === "Cartão de Crédito" && params.cardCount >= 2 && settlementDays >= 30) {
    d.setMonth(d.getMonth() + params.indexInCard + 1);
  } else {
    d.setDate(d.getDate() + settlementDays);
  }
  return { rate, fee, net, paymentDate: d };
}

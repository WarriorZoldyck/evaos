export interface InstallmentSplitPart {
  method: string;
  /** "bank:<id>" | "wallet:<id>" | "card:<id>" | "" */
  account: string;
  amount: number;
}

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
} {
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


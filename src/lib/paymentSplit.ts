export interface PaymentSplit {
  method: string;
  /** "bank:<id>" | "wallet:<id>" | "" */
  account: string;
  amount: number;
}

export const LIQUIDATION_METHODS = [
  "PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto",
  "Transferência", "Cheque", "Depósito", "Débito Automático", "Outro",
] as const;

const cents = (v: number) => Math.round((Number(v) || 0) * 100);

export function splitsTotal(splits: PaymentSplit[]): number {
  return splits.reduce((s, p) => s + cents(p.amount), 0) / 100;
}

/** Diferença (valor final − soma das partes), em reais, arredondada a centavos. */
export function splitsRemaining(finalAmount: number, splits: PaymentSplit[]): number {
  return (cents(finalAmount) - splits.reduce((s, p) => s + cents(p.amount), 0)) / 100;
}

export function validateSplits(finalAmount: number, splits: PaymentSplit[]): string | null {
  if (splits.length === 0) return "Adicione ao menos uma forma de pagamento.";
  for (const s of splits) {
    if (!s.method) return "Escolha a forma de pagamento de cada parte.";
    if (cents(s.amount) <= 0) return "Cada parte precisa ter valor maior que zero.";
    if (!s.account) return "Escolha a conta ou carteira de cada parte.";
  }
  const rem = splitsRemaining(finalAmount, splits);
  if (rem !== 0) return `A soma das partes difere do valor final em R$ ${Math.abs(rem).toFixed(2).replace(".", ",")}.`;
  return null;
}

export function parseAccount(account: string): { bank_account_id: string | null; wallet_id: string | null } {
  if (account.startsWith("wallet:")) return { bank_account_id: null, wallet_id: account.slice(7) };
  if (account.startsWith("bank:")) return { bank_account_id: account.slice(5), wallet_id: null };
  return { bank_account_id: null, wallet_id: null };
}

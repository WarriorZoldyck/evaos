export interface InstallmentSplitPart {
  method: string;
  /** "bank:<id>" | "wallet:<id>" | "card:<id>" | "" */
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
    if (p.method === "Dinheiro" && !acc.wallet_id) return "Selecione a carteira da parte em Dinheiro.";
    if (p.method === "Cartão de Crédito" && !acc.credit_card_id && !acc.bank_account_id) return "Selecione o cartão da parte no Cartão de Crédito.";
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


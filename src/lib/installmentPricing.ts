/**
 * Calculadora de parcelamento — funções puras.
 *
 * Objetivo: a partir do valor LÍQUIDO que o usuário precisa receber,
 * descobrir quanto cobrar do cliente em cada número de parcelas,
 * considerando a taxa da maquininha (desconto sobre o bruto) e/ou
 * um juro mensal (tabela Price).
 */

export interface InstallmentPlanRow {
  /** Número de parcelas. */
  installments: number;
  /** Valor de cada parcela cobrada do cliente. */
  installmentAmount: number;
  /** Total pago pelo cliente. */
  totalCharged: number;
  /** Valor líquido que o usuário recebe (após taxa da maquininha). */
  netReceived: number;
  /** Acréscimo sobre o valor líquido desejado. */
  surcharge: number;
  /** Acréscimo em percentual sobre o valor líquido desejado. */
  surchargePercent: number;
}

export interface InstallmentPlanInput {
  /** Valor líquido desejado (o que precisa sobrar no bolso). */
  netTarget: number;
  /** Taxa da maquininha em % sobre o valor bruto da venda. */
  acquirerRatePercent: number;
  /** Juro ao mês em % aplicado no parcelamento (tabela Price). */
  monthlyInterestPercent: number;
  /** Número máximo de parcelas a exibir. */
  maxInstallments: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Fator Price: valor da parcela para um valor presente unitário.
 * Com juro zero, é simplesmente 1/n.
 */
export function priceFactor(monthlyRate: number, installments: number): number {
  if (installments <= 0) return 0;
  if (monthlyRate <= 0) return 1 / installments;
  return monthlyRate / (1 - Math.pow(1 + monthlyRate, -installments));
}

/**
 * Calcula uma linha do plano para um número de parcelas.
 * Retorna null quando a taxa da maquininha inviabiliza o cálculo (>= 100%).
 */
export function computeInstallmentRow(
  input: Omit<InstallmentPlanInput, "maxInstallments">,
  installments: number,
): InstallmentPlanRow | null {
  const { netTarget, acquirerRatePercent, monthlyInterestPercent } = input;
  if (!Number.isFinite(netTarget) || netTarget <= 0) return null;
  if (acquirerRatePercent >= 100) return null;
  if (installments <= 0) return null;

  const acquirerFactor = 1 - acquirerRatePercent / 100;
  // Valor presente bruto necessário para que, após a taxa, sobre o líquido.
  const grossPresentValue = netTarget / acquirerFactor;

  const rate = Math.max(0, monthlyInterestPercent) / 100;
  const installmentAmount = round2(grossPresentValue * priceFactor(rate, installments));
  const totalCharged = round2(installmentAmount * installments);
  const netReceived = round2(totalCharged * acquirerFactor);

  return {
    installments,
    installmentAmount,
    totalCharged,
    netReceived,
    surcharge: round2(totalCharged - netTarget),
    surchargePercent: netTarget > 0 ? ((totalCharged - netTarget) / netTarget) * 100 : 0,
  };
}

/** Gera o plano completo de 1 até maxInstallments. */
export function buildInstallmentPlan(input: InstallmentPlanInput): InstallmentPlanRow[] {
  const max = Math.max(1, Math.min(48, Math.floor(input.maxInstallments || 1)));
  const rows: InstallmentPlanRow[] = [];
  for (let n = 1; n <= max; n++) {
    const row = computeInstallmentRow(input, n);
    if (row) rows.push(row);
  }
  return rows;
}

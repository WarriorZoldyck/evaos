/**
 * Calculadora de parcelamento — funções puras.
 *
 * Objetivo: a partir do valor LÍQUIDO que o usuário precisa receber,
 * descobrir quanto cobrar do cliente em cada número de parcelas,
 * considerando a taxa da maquininha (MDR por parcelamento) e/ou
 * um juro mensal (tabela Price), além do prazo de liquidação (D+X).
 */

export interface RateInfo {
  installments: number;
  rate: number;
}

export interface InstallmentPlanRow {
  /** Número de parcelas. */
  installments: number;
  /** Taxa MDR efetiva aplicada neste parcelamento (%). */
  rate: number;
  /** Valor de cada parcela cobrada do cliente. */
  installmentAmount: number;
  /** Total pago pelo cliente. */
  totalCharged: number;
  /** Valor líquido que o usuário recebe (após MDR). */
  netReceived: number;
  /** Acréscimo sobre o valor líquido desejado. */
  surcharge: number;
  /** Acréscimo em percentual sobre o valor líquido desejado. */
  surchargePercent: number;
  /** Modo de recebimento: antecipado (lump-sum D+X) ou parcelado mensal. */
  settlementMode: "lump_sum" | "installment";
  /** Dias de liquidação (D+X). */
  settlementDays: number;
  /** Data do primeiro crédito líquido. */
  firstCreditDate: Date | null;
  /** Data do último crédito líquido (igual ao primeiro quando antecipado). */
  lastCreditDate: Date | null;
}

export interface InstallmentPlanInput {
  /** Valor líquido desejado (o que precisa sobrar no bolso). */
  netTarget: number;
  /** Taxa MDR plana de fallback (%) — credit_rate do terminal. */
  acquirerRatePercent: number;
  /** Tabela de taxas por parcelamento (rates_info do terminal). */
  ratesInfo?: RateInfo[] | null;
  /** Juro ao mês em % aplicado no parcelamento (tabela Price). */
  monthlyInterestPercent: number;
  /** Número máximo de parcelas a exibir. */
  maxInstallments: number;
  /** Dias de liquidação de crédito (D+X). null = sem info de prazo. */
  settlementDaysCredit?: number | null;
  /** Indica se a maquininha antecipa (recebimento à vista em D+X). */
  autoAnticipation?: boolean;
  /** Data da venda — base para calcular as datas de crédito. */
  saleDate?: Date | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Resolve a taxa MDR para um número de parcelas, consultando a
 * tabela rates_info e caindo para a taxa plana de crédito.
 */
export function resolveRate(
  installments: number,
  acquirerRatePercent: number,
  ratesInfo?: RateInfo[] | null,
): number {
  if (ratesInfo && Array.isArray(ratesInfo) && ratesInfo.length > 0) {
    const match = ratesInfo.find((r) => r.installments === installments);
    if (match) return Number(match.rate);
    // Sem entrada exata: usa a taxa do maior parcelamento configurado
    // abaixo do atual (interpolação por degrau), senão cai no fallback.
    const lower = ratesInfo
      .filter((r) => r.installments <= installments)
      .sort((a, b) => b.installments - a.installments)[0];
    if (lower) return Number(lower.rate);
  }
  return acquirerRatePercent;
}

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
  const {
    netTarget,
    acquirerRatePercent,
    ratesInfo,
    monthlyInterestPercent,
    settlementDaysCredit,
    autoAnticipation,
    saleDate,
  } = input;
  if (!Number.isFinite(netTarget) || netTarget <= 0) return null;
  if (installments <= 0) return null;

  const rate = resolveRate(installments, acquirerRatePercent, ratesInfo);
  if (rate >= 100) return null;

  const acquirerFactor = 1 - rate / 100;
  // Valor presente bruto necessário para que, após a taxa, sobre o líquido.
  const grossPresentValue = netTarget / acquirerFactor;

  const monthlyRate = Math.max(0, monthlyInterestPercent) / 100;
  const installmentAmount = round2(grossPresentValue * priceFactor(monthlyRate, installments));
  const totalCharged = round2(installmentAmount * installments);
  const netReceived = round2(totalCharged * acquirerFactor);

  // --- Liquidação (D+X) ---
  // Espelha a lógica do MdrInfoCard: antecipação (settlement < 30) =>
  // lump-sum em D+X; caso contrário, crédito parcelado mensal.
  const hasSettlement =
    settlementDaysCredit != null && Number.isFinite(settlementDaysCredit) && settlementDaysCredit >= 0;
  const settlementDays = hasSettlement ? (settlementDaysCredit as number) : 0;
  const isLumpSum = hasSettlement ? settlementDays < 30 || !!autoAnticipation : true;

  let firstCreditDate: Date | null = null;
  let lastCreditDate: Date | null = null;

  if (saleDate && hasSettlement) {
    if (isLumpSum || installments === 1) {
      const d = new Date(saleDate);
      d.setDate(d.getDate() + settlementDays);
      firstCreditDate = d;
      lastCreditDate = d;
    } else {
      // Crédito parcelado mensal: parcela i vence ~1 mês após a venda,
      // e liquida em D+settlementDays após esse vencimento.
      const base = new Date(saleDate);
      const first = new Date(base);
      first.setMonth(first.getMonth() + 1);
      first.setDate(first.getDate() + settlementDays);
      const last = new Date(base);
      last.setMonth(last.getMonth() + installments);
      last.setDate(last.getDate() + settlementDays);
      firstCreditDate = first;
      lastCreditDate = last;
    }
  }

  return {
    installments,
    rate,
    installmentAmount,
    totalCharged,
    netReceived,
    surcharge: round2(totalCharged - netTarget),
    surchargePercent: netTarget > 0 ? ((totalCharged - netTarget) / netTarget) * 100 : 0,
    settlementMode: isLumpSum ? "lump_sum" : "installment",
    settlementDays,
    firstCreditDate,
    lastCreditDate,
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

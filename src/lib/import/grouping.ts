/**
 * Fase 3 — Conciliação em lote (1↔N).
 *
 * Funções puras para validar e montar um "grupo" de conciliação, onde
 * uma ou mais linhas do extrato são conciliadas contra um ou mais
 * lançamentos já existentes no sistema.
 *
 * Caso A — 1 linha do extrato ↔ N lançamentos do sistema.
 * Caso B — N linhas do extrato ↔ 1 lançamento do sistema.
 *
 * Regra de ouro: o extrato é a fonte absoluta. O grupo só é válido quando
 * a soma das linhas do extrato bate com a soma dos lançamentos do sistema
 * dentro da tolerância de centavos já usada pelo motor de matching.
 */

import { AMOUNT_TOLERANCE } from "@/lib/import/matching";

export interface GroupSystemTx {
  id: string;
  amount: number;
}

export interface GroupStatementRow {
  /** Índice da linha dentro do array `rows` da importação. */
  index: number;
  amount: number;
}

/** Estado persistido por linha-líder do grupo. */
export interface GroupState {
  /** IDs dos lançamentos do sistema que compõem o grupo. */
  systemIds: string[];
  /** Índices de OUTRAS linhas do extrato somadas junto com a líder. */
  extraRowIdx: number[];
}

export type GroupsMap = Record<number, GroupState>;

/** Soma valores absolutos, arredondando para 2 casas (evita ruído de float). */
export function sumAmounts(values: number[]): number {
  const total = values.reduce((s, v) => s + Math.abs(Number(v) || 0), 0);
  return Math.round(total * 100) / 100;
}

export function sumCandidates(candidates: GroupSystemTx[]): number {
  return sumAmounts(candidates.map((c) => c.amount));
}

export interface GroupBalance {
  /** Soma das linhas do extrato participantes do grupo. */
  statementTotal: number;
  /** Soma dos lançamentos do sistema selecionados. */
  systemTotal: number;
  /** statementTotal − systemTotal (positivo = falta selecionar sistema). */
  delta: number;
  /** true quando |delta| ≤ tolerância. */
  balanced: boolean;
  /** Motivo de invalidez, quando houver. */
  reason?: "no-statement" | "no-system" | "unbalanced";
  valid: boolean;
}

export function validateGroupBalance(
  statementRows: GroupStatementRow[],
  systemTxs: GroupSystemTx[],
  tolerance: number = AMOUNT_TOLERANCE,
): GroupBalance {
  const statementTotal = sumAmounts(statementRows.map((r) => r.amount));
  const systemTotal = sumCandidates(systemTxs);
  const delta = Math.round((statementTotal - systemTotal) * 100) / 100;
  const balanced = Math.abs(delta) <= tolerance;

  let reason: GroupBalance["reason"];
  if (statementRows.length === 0) reason = "no-statement";
  else if (systemTxs.length === 0) reason = "no-system";
  else if (!balanced) reason = "unbalanced";

  return {
    statementTotal,
    systemTotal,
    delta,
    balanced,
    reason,
    valid: !reason,
  };
}

/** Um grupo só faz sentido a partir de 2 participantes de algum lado. */
export function isBatchGroup(state: GroupState): boolean {
  return state.systemIds.length > 1 || state.extraRowIdx.length > 0;
}

/** Todos os índices de linha do extrato envolvidos em um grupo (líder incluída). */
export function groupRowIndexes(leaderIdx: number, state: GroupState): number[] {
  return [leaderIdx, ...state.extraRowIdx];
}

/** Conjunto com TODAS as linhas do extrato presas a algum grupo. */
export function collectGroupedRows(groups: GroupsMap): Set<number> {
  const out = new Set<number>();
  Object.entries(groups).forEach(([k, g]) => {
    groupRowIndexes(Number(k), g).forEach((i) => out.add(i));
  });
  return out;
}

/** Conjunto com TODOS os IDs de lançamentos do sistema presos a algum grupo. */
export function collectGroupedSystemIds(groups: GroupsMap): Set<string> {
  const out = new Set<string>();
  Object.values(groups).forEach((g) => g.systemIds.forEach((id) => out.add(id)));
  return out;
}

export interface GroupPlanUpdate {
  /** Lançamento do sistema a ser atualizado. */
  id: string;
  /** Data efetiva vinda do extrato (YYYY-MM-DD). */
  payment_date: string;
  is_reconciled: true;
  /**
   * Fingerprint da linha do extrato correspondente. Só é atribuído a UM
   * lançamento por linha — o índice único (user_id, import_fingerprint)
   * não permite repetição.
   */
  import_fingerprint?: string;
}

export interface GroupPlanInput {
  leaderIdx: number;
  state: GroupState;
  /** Linhas do extrato, na ordem original da importação. */
  rows: { date: string; amount: number }[];
  /** Lançamentos do sistema disponíveis, por id. */
  systemById: Map<string, GroupSystemTx>;
  /** Fingerprint por índice de linha (quando disponível). */
  fingerprints?: Record<number, string>;
}

/**
 * Monta os updates que devem ser aplicados no commit da importação.
 * Nenhuma transação nova é criada para linhas agrupadas.
 */
export function buildGroupPlan(input: GroupPlanInput): GroupPlanUpdate[] {
  const { leaderIdx, state, rows, fingerprints } = input;
  const rowIdxs = groupRowIndexes(leaderIdx, state);
  const leaderDate = rows[leaderIdx]?.date;
  if (!leaderDate) return [];

  return state.systemIds.map((id, k) => {
    const rowIdx = rowIdxs[k];
    const fp = rowIdx !== undefined && fingerprints ? fingerprints[rowIdx] : undefined;
    const update: GroupPlanUpdate = {
      id,
      payment_date: rows[rowIdx]?.date || leaderDate,
      is_reconciled: true,
    };
    if (fp) update.import_fingerprint = fp;
    return update;
  });
}

/** Plano completo de todos os grupos confirmados. */
export function buildAllGroupPlans(
  groups: GroupsMap,
  rows: { date: string; amount: number }[],
  systemById: Map<string, GroupSystemTx>,
  fingerprints?: Record<number, string>,
): GroupPlanUpdate[] {
  return Object.entries(groups).flatMap(([k, state]) =>
    buildGroupPlan({ leaderIdx: Number(k), state, rows, systemById, fingerprints }),
  );
}

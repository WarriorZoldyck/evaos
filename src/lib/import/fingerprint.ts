/**
 * Impressão digital de linha de extrato — usada para impedir que o MESMO
 * extrato seja importado duas vezes (Fase 2A da conciliação de conta).
 *
 * A chave é determinística e legível: conta destino + data + valor + tipo +
 * descrição normalizada. Ela é gravada em `transactions.import_fingerprint`,
 * protegida por um índice único parcial (user_id, import_fingerprint).
 */

/** Remove acentos, pontuação ruidosa e espaços duplicados; devolve MAIÚSCULAS. */
export function normalizeDescriptionForFingerprint(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export interface FingerprintInput {
  /** "bank:<uuid>" | "wallet:<uuid>" — conta destino da importação. */
  accountKey: string;
  /** Data da linha no extrato (YYYY-MM-DD). */
  date: string;
  /** Valor absoluto em reais. */
  amount: number;
  /** "receita" | "despesa" */
  type: string;
  /** Texto original da linha do extrato. */
  description: string;
}

export function buildImportFingerprint(input: FingerprintInput): string {
  const amount = Math.abs(Number(input.amount) || 0).toFixed(2);
  const type = input.type === "receita" ? "r" : "d";
  const desc = normalizeDescriptionForFingerprint(input.description);
  return `${input.accountKey}|${input.date}|${amount}|${type}|${desc}`;
}

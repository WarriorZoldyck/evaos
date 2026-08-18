/**
 * Fonte ÚNICA de verdade da decisão de uma linha do extrato.
 *
 * Antes existiam dois padrões conflitantes: a tela contava linha sem ação como
 * "criar" (`matchActions[i] || "criar"`) e o commit contava como "ignorar".
 * Resultado: linhas apareciam confirmadas na tela e sumiam silenciosamente na
 * importação. Todo mundo agora passa por aqui.
 */
export type RowAction = "vincular" | "criar" | "ignorar";
export type RowDisposition = "link" | "create" | "ignore-explicit";

/** Ação efetiva da linha. Sem decisão = "ignorar" (toggle desligado). */
export function effectiveAction(
  action: RowAction | undefined,
  reviewed = false,
): RowAction {
  if (action) return action;
  // Selo "Confirmada" na tela sem ação registrada = intenção de criar.
  return reviewed ? "criar" : "ignorar";
}

export function rowDisposition(
  action: RowAction | undefined,
  hasTarget: boolean,
  reviewed = false,
): RowDisposition {
  const a = effectiveAction(action, reviewed);
  if (a === "vincular" && hasTarget) return "link";
  if (a === "criar") return "create";
  return "ignore-explicit";
}

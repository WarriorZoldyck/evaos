/**
 * Detector de transferência interna em extrato de conta corrente (Fase 2B).
 *
 * Extratos trazem PIX/TED/DOC entre contas do PRÓPRIO usuário. Se essas linhas
 * virarem receita/despesa comum, elas inflam o DRE. Aqui apenas SUGERIMOS:
 * o usuário sempre pode desfazer com um clique.
 */

export interface TransferAccountRef {
  /** "bank:<uuid>" | "wallet:<uuid>" */
  key: string;
  name: string;
  /** CNPJ/CPF ou número da conta, quando houver. */
  document?: string | null;
}

export interface TransferDetection {
  isTransfer: boolean;
  /** Conta do usuário identificada na descrição (contraparte), quando houver. */
  counterpartKey?: string;
  reason?: string;
}

/**
 * Palavras que, sozinhas, JÁ indicam movimento interno (não há terceiro
 * envolvido). PIX/TED comuns ficam de fora: a maioria é pagamento a terceiros.
 */
const STRONG_INTERNAL_KEYWORDS = [
  "TRANSF ENTRE CONTAS",
  "TRANSFERENCIA ENTRE CONTAS",
  "TRANSF CONTA CORRENTE",
  "RESGATE APLIC",
  "RESGATE AUTOMATICO",
  "RESGATE INVEST",
  "APLICACAO AUTOMATICA",
  "APLIC AUTOMATICA",
  "APLICACAO INVEST",
];

/** Palavras que só reforçam a suspeita quando a contraparte também bate. */
const TRANSFER_HINTS = ["PIX", "TED", "DOC", "TRANSF"];

function normalize(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(raw?: string | null): string {
  return (raw || "").replace(/\D+/g, "");
}

/**
 * @param description Texto da linha do extrato.
 * @param accounts    Contas/carteiras do usuário (exceto a conta destino da importação).
 */
export function detectInternalTransfer(
  description: string,
  accounts: TransferAccountRef[],
): TransferDetection {
  const desc = normalize(description);
  if (!desc) return { isTransfer: false };

  const strong = STRONG_INTERNAL_KEYWORDS.find((k) => desc.includes(k));
  const hasHint = TRANSFER_HINTS.some((k) => desc.includes(k));

  // 1) Contraparte explícita: nome ou documento de outra conta do usuário.
  for (const acc of accounts) {
    const accName = normalize(acc.name);
    const doc = onlyDigits(acc.document);
    const nameHit = accName.length >= 4 && desc.includes(accName);
    const docHit = doc.length >= 6 && onlyDigits(desc).includes(doc);
    if (nameHit || docHit) {
      return {
        isTransfer: true,
        counterpartKey: acc.key,
        reason: nameHit ? `Conta "${acc.name}" citada na descrição` : "Documento da sua conta na descrição",
      };
    }
  }

  // 2) Movimento interno explícito (resgate/aplicação/entre contas).
  if (strong) {
    return { isTransfer: true, reason: `Movimento interno: "${strong}"` };
  }

  // PIX/TED/DOC solto NÃO é transferência interna — quase sempre é terceiro.
  void hasHint;

  return { isTransfer: false };
}

import {
  computeGoalScore,
  formatBRL,
  STATUS_LABEL,
  type GoalResolutionAction,
} from "@/lib/goalPlanning";
import type {
  AssistantReply,
  AssistantService,
  GoalPlanningContext,
} from "./AssistantService";

/**
 * Implementação TEMPORÁRIA do AssistantService.
 * Responde sempre a partir do contexto financeiro estruturado recebido.
 * Nunca inventa score: delega a computeGoalScore.
 * Será substituída pelo agente EVA real sem mudar a UI.
 */

const parseMonths = (text: string): number | null => {
  const t = text.toLowerCase();
  const anos = t.match(/(\d+)\s*ano/);
  if (anos) return Number(anos[1]) * 12;
  const meses = t.match(/(\d+)\s*(meses|mes|mês)/);
  if (meses) return Number(meses[1]);
  return null;
};

const parseAmount = (text: string): number | null => {
  const m = text
    .toLowerCase()
    .match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais)?/);
  if (!m) return null;
  const raw = m[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/\.(?=\d{3}\b)/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const mentionsContribution = (text: string) =>
  /(guardar|reservar|aporte|separar|poupar|por m[êe]s|mensal)/i.test(text);

export class LocalAssistantService implements AssistantService {
  async sendMessage(context: GoalPlanningContext): Promise<AssistantReply> {
    const { goal, financialStats, topCategories, conversationHistory } = context;
    const last = [...conversationHistory].reverse().find((m) => m.role === "user");
    const text = last?.text ?? "";

    if (!goal) {
      return {
        text:
          "Escolha ou crie um cofrinho para começarmos. Com o alvo e o prazo definidos eu consigo dizer se ele cabe no seu mês.",
      };
    }

    const capacityLine = `Sua capacidade mensal estimada é de ${formatBRL(financialStats.monthlyCapacity)} (entradas médias ${formatBRL(financialStats.avgIncomeMonth)} − saídas médias ${formatBRL(financialStats.avgSpentMonth)}).`;

    const months = parseMonths(text);
    if (months && months > 0) {
      const action: GoalResolutionAction = {
        kind: "EXTEND_DEADLINE",
        months: 0,
      };
      const deadline = new Date();
      deadline.setMonth(deadline.getMonth() + months);
      const iso = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`;
      const patched = { ...goal, deadline: iso };
      const result = computeGoalScore({
        goal: patched,
        monthlyCapacity: financialStats.monthlyCapacity,
      });
      const need = result.breakdown.requiredContribution;
      void action;
      return {
        text: `Com prazo de ${months} ${months === 1 ? "mês" : "meses"}, você precisa reservar ${need !== null ? formatBRL(need) : "—"} por mês. ${capacityLine} Situação: ${STATUS_LABEL[result.status].toLowerCase()}.`,
        goalPatch: { deadline: iso },
      };
    }

    if (mentionsContribution(text)) {
      const amount = parseAmount(text);
      if (amount) {
        const result = computeGoalScore({
          goal: { ...goal, monthlyContribution: amount },
          monthlyCapacity: financialStats.monthlyCapacity,
        });
        const need = result.breakdown.requiredContribution;
        const gap = result.breakdown.capacityGap ?? 0;
        const diagnosis =
          need === null
            ? "Defina um prazo para eu comparar com o necessário."
            : gap >= 0
              ? `Isso cobre o necessário de ${formatBRL(need)} por mês.`
              : `Ainda faltam ${formatBRL(Math.abs(gap))} por mês frente aos ${formatBRL(need)} necessários.`;
        const suggestion =
          gap < 0 && topCategories.length > 0
            ? ` A maior saída hoje é ${topCategories[0].name} (${formatBRL(Math.abs(topCategories[0].total))}/mês) — é o melhor lugar para buscar essa diferença.`
            : "";
        return {
          text: `Anotado: aporte de ${formatBRL(amount)} por mês. ${diagnosis}${suggestion}`,
          goalPatch: { monthlyContribution: amount },
          resolutionActions:
            gap < 0 ? [{ kind: "REDUCE_EXPENSE", amount: Math.abs(gap) }] : undefined,
        };
      }
    }

    const result = computeGoalScore({
      goal,
      monthlyCapacity: financialStats.monthlyCapacity,
    });
    const need = result.breakdown.requiredContribution;
    const base =
      need === null
        ? `Ainda falta definir o prazo de "${goal.title}". Me diga em quanto tempo quer concluir (ex.: 12 meses) que eu calculo o aporte necessário.`
        : `Para "${goal.title}" faltam ${formatBRL(result.breakdown.remainingAmount)}, o que dá ${formatBRL(need)} por mês em ${result.breakdown.monthsRemaining} ${result.breakdown.monthsRemaining === 1 ? "mês" : "meses"}. Situação: ${STATUS_LABEL[result.status].toLowerCase()}.`;

    return { text: `${base} ${capacityLine}` };
  }
}

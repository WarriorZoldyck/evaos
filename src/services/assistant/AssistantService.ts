import type {
  PlanningGoal,
  GoalScoreResult,
  GoalResolutionAction,
  ActionPlanItem,
  CategoryAmount,
} from "@/lib/goalPlanning";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export interface FinancialSnapshot {
  totalBalance: number;
  avgIncomeMonth: number;
  avgSpentMonth: number;
  /** Capacidade financeira mensal estimada. */
  monthlyCapacity: number;
}

export interface GoalPlanningContext {
  goal: PlanningGoal | null;
  scoreResult: GoalScoreResult | null;
  financialStats: FinancialSnapshot;
  topCategories: CategoryAmount[];
  conversationHistory: ChatMessage[];
}

export interface AssistantReply {
  text: string;
  goalPatch?: Partial<PlanningGoal>;
  resolutionActions?: GoalResolutionAction[];
  actions?: ActionPlanItem[];
}

export interface AssistantService {
  sendMessage(context: GoalPlanningContext): Promise<AssistantReply>;
}

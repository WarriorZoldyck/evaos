import { addDays, addMonths, differenceInCalendarDays, endOfYear, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

import avatarAurora from "@/assets/kids/avatar-aurora.jpg";
import avatarSol from "@/assets/kids/avatar-sol.jpg";
import avatarCometa from "@/assets/kids/avatar-cometa.jpg";
import avatarBrasa from "@/assets/kids/avatar-brasa.jpg";
import avatarLua from "@/assets/kids/avatar-lua.jpg";
import avatarVento from "@/assets/kids/avatar-vento.jpg";
import evaGuide from "@/assets/kids/eva-guide.jpg";

// ───────────────────────── Constants ─────────────────────────
/** Prefix used to identify Kids wallets */
export const KIDS_WALLET_PREFIX = "Kids - ";
/** Marker stored in `notes` of recurring_transactions / transactions created by the allowance engine */
export const KIDS_ALLOWANCE_MARKER = "eva_kids_allowance";
/**
 * Kid constellations live in `goals` with goal_type "outro" and icon = "kids:<walletId>:<emoji>".
 * (goal_type has a CHECK constraint, so the marker lives in the free-text icon column.)
 * useGoals filters these out so they never show up on the adult Metas page.
 */
export const KIDS_GOAL_PREFIX = "kids:";
export const isKidGoalIcon = (icon: string | null | undefined) => !!icon && icon.startsWith(KIDS_GOAL_PREFIX);

export const EVA_GUIDE_IMAGE = evaGuide;

export type Tx = Tables<"transactions">;

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// ───────────────────────── Avatars ─────────────────────────
export const KID_AVATARS = [
  { id: "aurora", name: "Aurora", src: avatarAurora, ring: "ring-pink-300/70" },
  { id: "sol", name: "Sol", src: avatarSol, ring: "ring-amber-300/70" },
  { id: "cometa", name: "Cometa", src: avatarCometa, ring: "ring-sky-300/70" },
  { id: "brasa", name: "Brasa", src: avatarBrasa, ring: "ring-orange-300/70" },
  { id: "lua", name: "Lua", src: avatarLua, ring: "ring-violet-300/70" },
  { id: "vento", name: "Vento", src: avatarVento, ring: "ring-emerald-300/70" },
] as const;

const avatarKey = (walletId: string) => `evakids_avatar_${walletId}`;

export function getKidAvatar(walletId: string) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(avatarKey(walletId)); } catch { /* ignore */ }
  const found = KID_AVATARS.find((a) => a.id === stored);
  if (found) return found;
  // Deterministic default based on wallet id
  let hash = 0;
  for (let i = 0; i < walletId.length; i++) hash = (hash * 31 + walletId.charCodeAt(i)) >>> 0;
  return KID_AVATARS[hash % KID_AVATARS.length];
}

export function setKidAvatar(walletId: string, avatarId: string) {
  try { localStorage.setItem(avatarKey(walletId), avatarId); } catch { /* ignore */ }
}

// ───────────────────────── Allowance rules ─────────────────────────
export interface AllowanceRule {
  id: string;
  wallet_id: string;
  amount: number;
  frequency: "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string; // yyyy-MM-dd (first possible deposit)
}

const RULE_COLUMNS = "id, wallet_id, amount, frequency, day_of_week, day_of_month, start_date";

export async function fetchAllowanceRules(walletIds: string[]): Promise<Record<string, AllowanceRule>> {
  if (walletIds.length === 0) return {};
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(RULE_COLUMNS)
    .in("wallet_id", walletIds)
    .eq("notes", KIDS_ALLOWANCE_MARKER);
  if (error || !data) return {};
  const map: Record<string, AllowanceRule> = {};
  (data as AllowanceRule[]).forEach((r) => { if (r.wallet_id) map[r.wallet_id] = { ...r, amount: Number(r.amount) }; });
  return map;
}

export async function saveAllowanceRule(params: {
  existingId?: string | null;
  userId: string;
  walletId: string;
  amount: number;
  frequency: "weekly" | "monthly";
  dayOfWeek: number;
  dayOfMonth: number;
}): Promise<AllowanceRule> {
  // New schedule applies from tomorrow on (deposits already made stay untouched)
  const startDate = format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
  const payload = {
    amount: params.amount,
    frequency: params.frequency,
    day_of_week: params.frequency === "weekly" ? params.dayOfWeek : null,
    day_of_month: params.frequency === "monthly" ? params.dayOfMonth : null,
    start_date: startDate,
  };

  if (params.existingId) {
    const { data, error } = await supabase
      .from("recurring_transactions")
      .update(payload)
      .eq("id", params.existingId)
      .select(RULE_COLUMNS)
      .single();
    if (error) throw error;
    return { ...(data as AllowanceRule), amount: Number(data.amount) };
  }

  const insert: TablesInsert<"recurring_transactions"> = {
    ...payload,
    user_id: params.userId,
    wallet_id: params.walletId,
    type: "receita",
    description: "Mesada",
    category: "Mesada",
    notes: KIDS_ALLOWANCE_MARKER,
  };
  const { data, error } = await supabase
    .from("recurring_transactions")
    .insert(insert)
    .select(RULE_COLUMNS)
    .single();
  if (error) throw error;
  return { ...(data as AllowanceRule), amount: Number(data.amount) };
}

export async function deleteAllowanceRule(id: string) {
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) throw error;
}

/** All allowance dates between [from, to] (inclusive), respecting the rule's start date */
export function getAllowanceDates(rule: AllowanceRule, from: Date, to: Date): Date[] {
  const start = new Date(rule.start_date + "T00:00:00");
  let cursor = startOfDay(from < start ? start : from);
  const end = startOfDay(to);
  const dates: Date[] = [];
  if (cursor > end) return dates;

  if (rule.frequency === "weekly") {
    const target = rule.day_of_week ?? 1;
    const delta = (target - cursor.getDay() + 7) % 7;
    cursor = addDays(cursor, delta);
    while (cursor <= end && dates.length < 400) {
      dates.push(cursor);
      cursor = addDays(cursor, 7);
    }
  } else {
    const target = rule.day_of_month ?? 5;
    const clamp = (y: number, m: number) => new Date(y, m, Math.min(target, new Date(y, m + 1, 0).getDate()));
    let candidate = clamp(cursor.getFullYear(), cursor.getMonth());
    if (candidate < cursor) {
      const next = addMonths(new Date(cursor.getFullYear(), cursor.getMonth(), 1), 1);
      candidate = clamp(next.getFullYear(), next.getMonth());
    }
    while (candidate <= end && dates.length < 400) {
      dates.push(candidate);
      const next = addMonths(new Date(candidate.getFullYear(), candidate.getMonth(), 1), 1);
      candidate = clamp(next.getFullYear(), next.getMonth());
    }
  }
  return dates;
}

/** Next deposit strictly after today (deposits for today are materialized already) */
export function getNextAllowanceDate(rule: AllowanceRule): Date | null {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const dates = getAllowanceDates(rule, tomorrow, addDays(tomorrow, 400));
  return dates[0] ?? null;
}

/** Upcoming deposits (after today) until `until` (default: end of the year) */
export function getUpcomingAllowances(rule: AllowanceRule, until: Date = endOfYear(new Date())): Date[] {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  return getAllowanceDates(rule, tomorrow, until);
}

export function relativeDayLabel(date: Date): string {
  const diff = differenceInCalendarDays(date, startOfDay(new Date()));
  if (diff <= 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff} dias`;
}

export function formatShortDate(date: Date) {
  return format(date, "EEE, dd/MM", { locale: ptBR });
}

export function describeRule(rule: Pick<AllowanceRule, "frequency" | "day_of_week" | "day_of_month">) {
  return rule.frequency === "weekly"
    ? `Toda ${WEEKDAYS[rule.day_of_week ?? 1].toLowerCase()}`
    : `Todo dia ${rule.day_of_month ?? 5} do mês`;
}

/**
 * Materializes any allowance deposit that is due (start_date..today) but not yet
 * registered as a transaction. Safe to call repeatedly (dedupes by date).
 * Returns how many deposits were created.
 */
export async function syncAllowanceDeposits(rule: AllowanceRule, userId: string): Promise<number> {
  const today = startOfDay(new Date());
  const due = getAllowanceDates(rule, new Date(rule.start_date + "T00:00:00"), today);
  if (due.length === 0) return 0;

  const { data: existing } = await supabase
    .from("transactions")
    .select("payment_date")
    .eq("wallet_id", rule.wallet_id)
    .eq("notes", KIDS_ALLOWANCE_MARKER)
    .gte("payment_date", rule.start_date);

  const existingDates = new Set((existing || []).map((t) => t.payment_date));
  const missing = due.map((d) => format(d, "yyyy-MM-dd")).filter((d) => !existingDates.has(d));
  if (missing.length === 0) return 0;

  const payloads: TablesInsert<"transactions">[] = missing.map((d) => ({
    user_id: userId,
    wallet_id: rule.wallet_id,
    type: "receita",
    description: "Mesada",
    category: "Mesada",
    amount: rule.amount,
    payment_date: d,
    competence_date: d,
    status: "Pago",
    notes: KIDS_ALLOWANCE_MARKER,
  }));
  const { error } = await supabase.from("transactions").insert(payloads);
  if (error) {
    console.error("[EVA Kids] erro ao materializar mesada", error);
    return 0;
  }
  return missing.length;
}

// ───────────────────────── Kid goals (Constellations) ─────────────────────────
export interface KidGoal {
  id: string;
  name: string;
  icon: string | null;
  target_amount: number;
  current_amount: number;
  created_at: string | null;
}

export async function fetchKidGoals(walletId: string): Promise<KidGoal[]> {
  const marker = `${KIDS_GOAL_PREFIX}${walletId}:`;
  const { data, error } = await supabase
    .from("goals")
    .select("id, name, icon, target_amount, current_amount, created_at")
    .like("icon", `${marker}%`)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((g) => ({
    ...g,
    icon: (g.icon || "").slice(marker.length) || "⭐",
    target_amount: Number(g.target_amount),
    current_amount: Number(g.current_amount),
  }));
}

export async function createKidGoal(userId: string, walletId: string, name: string, target: number, emoji: string) {
  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    name,
    icon: `${KIDS_GOAL_PREFIX}${walletId}:${emoji}`,
    target_amount: target,
    current_amount: 0,
    goal_type: "outro",
  });
  if (error) throw error;
}

export async function updateKidGoalAmount(goalId: string, amount: number) {
  const { error } = await supabase.from("goals").update({ current_amount: Math.max(0, amount) }).eq("id", goalId);
  if (error) throw error;
}

export async function deleteKidGoal(goalId: string) {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
}

// ───────────────────────── Balance helpers ─────────────────────────
export function computeBalances(transactions: Tx[]) {
  const today = format(new Date(), "yyyy-MM-dd");
  let balance = 0;
  transactions.forEach((t) => {
    if (t.payment_date && t.payment_date <= today) {
      balance += t.type === "receita" ? Number(t.amount) : -Number(t.amount);
    }
  });
  return { balance };
}

// ───────────────────────── Badges (achievements) ─────────────────────────
export interface KidBadge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
}

export function evaluateBadges(transactions: Tx[], goals: KidGoal[], balance: number): KidBadge[] {
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");
  const past = transactions.filter((t) => t.payment_date && t.payment_date <= todayStr);
  const incomes = past.filter((t) => t.type === "receita");
  const expenses = past.filter((t) => t.type === "despesa");
  const weekAgo = format(addDays(today, -7), "yyyy-MM-dd");
  const spentLastWeek = expenses.some((t) => t.payment_date >= weekAgo);
  const hasHistoryOverWeek = past.some((t) => t.payment_date < weekAgo);

  return [
    { id: "primeira-luz", emoji: "✨", title: "Primeira Luz", description: "Recebeu o primeiro brilho na constelação.", unlocked: incomes.length > 0 },
    { id: "sonhador", emoji: "🌌", title: "Sonhador", description: "Criou a primeira constelação (meta).", unlocked: goals.length > 0 },
    { id: "semana-serena", emoji: "🌙", title: "Semana Serena", description: "Passou 7 dias guardando, sem gastar nada.", unlocked: hasHistoryOverWeek && !spentLastWeek },
    { id: "guardiao-50", emoji: "🛡️", title: "Guardião da Luz", description: "Juntou R$ 50 de brilho.", unlocked: balance >= 50 },
    { id: "guardiao-100", emoji: "🌟", title: "Grande Guardião", description: "Juntou R$ 100 de brilho.", unlocked: balance >= 100 },
    { id: "constelacao-completa", emoji: "🏆", title: "Constelação Completa", description: "Completou uma meta inteirinha!", unlocked: goals.some((g) => g.target_amount > 0 && g.current_amount >= g.target_amount) },
  ];
}

const seenBadgesKey = (walletId: string) => `evakids_badges_seen_${walletId}`;

export function getSeenBadges(walletId: string): string[] {
  try { return JSON.parse(localStorage.getItem(seenBadgesKey(walletId)) || "[]"); } catch { return []; }
}

export function markBadgesSeen(walletId: string, ids: string[]) {
  try { localStorage.setItem(seenBadgesKey(walletId), JSON.stringify(Array.from(new Set([...getSeenBadges(walletId), ...ids])))); } catch { /* ignore */ }
}

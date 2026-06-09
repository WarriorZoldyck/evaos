import {
  Utensils,
  Home,
  Heart,
  Car,
  Gem,
  ShoppingBag,
  Briefcase,
  Stethoscope,
  GraduationCap,
  Plane,
  Coffee,
  Smartphone,
  Zap,
  Tag,
  type LucideIcon,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  format,
  parseISO,
  differenceInDays,
} from "date-fns";

type Tx = {
  amount: number | string;
  type: "receita" | "despesa";
  status: "Pago" | "Pendente";
  payment_date: string;
  category: string;
};

export function getCategoryIcon(name: string): LucideIcon {
  const n = (name || "").toLowerCase();
  if (/(aliment|comida|restaur|merc|superm)/.test(n)) return Utensils;
  if (/(moradia|alug|casa|imóv|imovel|condom)/.test(n)) return Home;
  if (/(saúde|saude|clínic|clinic|hospital|farmá|farmac|medic)/.test(n))
    return Stethoscope;
  if (/(transp|combust|uber|99|gasol|carro|veíc|veic)/.test(n)) return Car;
  if (/(superfl|lazer|present|joia|hobby)/.test(n)) return Gem;
  if (/(compr|shopping|vestu|roupa)/.test(n)) return ShoppingBag;
  if (/(trabalho|salár|salar|servic|serviç|consult)/.test(n)) return Briefcase;
  if (/(educa|escola|curso|faculda)/.test(n)) return GraduationCap;
  if (/(viagem|turismo|hotel|passag)/.test(n)) return Plane;
  if (/(café|cafe|bar|pub)/.test(n)) return Coffee;
  if (/(celular|tel|internet|telefon|assin)/.test(n)) return Smartphone;
  if (/(luz|água|agua|energia|conta)/.test(n)) return Zap;
  if (/(coração|coracao|amor)/.test(n)) return Heart;
  return Tag;
}

export function pctChange(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function getPreviousPeriodRange(start: Date, end: Date) {
  const days = differenceInDays(end, start) + 1;
  // For "month" period, prefer previous calendar month
  const startMonth = startOfMonth(start);
  if (startMonth.getTime() === start.getTime() && endOfMonth(start).getTime() === end.getTime()) {
    const prev = subMonths(start, 1);
    return { start: startOfMonth(prev), end: endOfMonth(prev) };
  }
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { start: prevStart, end: prevEnd };
}

export function dailySeries(
  txs: Tx[],
  start: Date,
  end: Date,
  reducer: (t: Tx) => number,
): { date: string; v: number }[] {
  const days = eachDayOfInterval({ start, end });
  const map = new Map<string, number>();
  txs.forEach((t) => {
    if (t.status !== "Pago") return;
    const k = t.payment_date;
    map.set(k, (map.get(k) || 0) + reducer(t));
  });
  return days.map((d) => {
    const k = format(d, "yyyy-MM-dd");
    return { date: format(d, "dd/MM"), v: map.get(k) || 0 };
  });
}

export function sumInRange(
  txs: Tx[],
  start: Date,
  end: Date,
  predicate: (t: Tx) => boolean,
): number {
  const s = format(start, "yyyy-MM-dd");
  const e = format(end, "yyyy-MM-dd");
  return txs
    .filter(
      (t) =>
        t.status === "Pago" &&
        t.payment_date >= s &&
        t.payment_date <= e &&
        predicate(t),
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);
}

/**
 * Feriados nacionais brasileiros — cálculo puro, sem rede.
 */

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return out;
};

const toISO = (d: Date) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Feriados nacionais do ano (fixos + móveis). */
export function brazilHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: iso(year, 1, 1), name: "Confraternização Universal" },
    { date: toISO(addDays(easter, -48)), name: "Carnaval (segunda)" },
    { date: toISO(addDays(easter, -47)), name: "Carnaval" },
    { date: toISO(addDays(easter, -2)), name: "Sexta-feira Santa" },
    { date: iso(year, 4, 21), name: "Tiradentes" },
    { date: iso(year, 5, 1), name: "Dia do Trabalho" },
    { date: toISO(addDays(easter, 60)), name: "Corpus Christi" },
    { date: iso(year, 9, 7), name: "Independência do Brasil" },
    { date: iso(year, 10, 12), name: "Nossa Senhora Aparecida" },
    { date: iso(year, 11, 2), name: "Finados" },
    { date: iso(year, 11, 15), name: "Proclamação da República" },
    { date: iso(year, 11, 20), name: "Consciência Negra" },
    { date: iso(year, 12, 25), name: "Natal" },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Mapa data → nome, para o ano informado. */
export function holidayMap(year: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of brazilHolidays(year)) out[h.date] = h.name;
  return out;
}

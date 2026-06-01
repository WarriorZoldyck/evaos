// Pure utilities for computing credit card invoice due dates.
// Single source of truth used by frontend (modal, payment fields) to avoid
// drift with the edge function implementation in
// supabase/functions/_shared/creditCardDueDate.ts (keep them in sync).

const pad = (n: number) => String(n).padStart(2, "0");

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(iso: string): Date {
  // Noon to avoid any DST/timezone slips when manipulating the date.
  return new Date(iso + "T12:00:00");
}

function clampDay(year: number, month: number, day: number): Date {
  // Handles cases like dueDay=31 in February.
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * Returns the invoice due date (YYYY-MM-DD) for a purchase made on
 * `competenceISO`, given the card's closing/due days.
 *
 * Rule: if compDay >= closingDay → purchase falls in NEXT billing cycle.
 *       if dueDay < closingDay   → due date is one month after billing month.
 */
export function getCreditCardDueDate(
  competenceISO: string,
  closingDay: number,
  dueDay: number
): string {
  const comp = parseISO(competenceISO);
  const compDay = comp.getDate();
  const compMonth = comp.getMonth();
  const compYear = comp.getFullYear();

  let billMonth = compDay >= closingDay ? compMonth + 1 : compMonth;
  let billYear = compYear;
  if (billMonth > 11) {
    billMonth -= 12;
    billYear++;
  }

  let dueMonth = billMonth;
  let dueYear = billYear;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth -= 12;
      dueYear++;
    }
  }

  return toISO(clampDay(dueYear, dueMonth, dueDay));
}

/**
 * Returns the due date for installment N of a series, advancing the
 * competence by (installmentNumber - 1) months before applying the cycle.
 * `installmentNumber` is 1-based.
 */
export function getInstallmentDueDate(
  competenceISO: string,
  closingDay: number,
  dueDay: number,
  installmentNumber: number
): string {
  const base = parseISO(competenceISO);
  const advanced = new Date(base);
  advanced.setMonth(advanced.getMonth() + (installmentNumber - 1));
  return getCreditCardDueDate(toISO(advanced), closingDay, dueDay);
}

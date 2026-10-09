/** Date helpers for Indian Standard Time (UTC+05:30, no daylight saving). */

const IST_OFFSET = '+05:30';
const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const istDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** "YYYY-MM-DD" of `date` in IST. */
export function istDay(date = new Date()): string {
  return istDate.format(date);
}

/** "YYYY-MM-DD HH:mm" in IST, for statements. */
export function istDateTimeText(date: Date): string {
  return istDateTime.format(date);
}

/** Start of an IST calendar day given as "YYYY-MM-DD". */
export function startOfIstDay(day: string): Date {
  return new Date(`${day}T00:00:00.000${IST_OFFSET}`);
}

/** End (last millisecond) of an IST calendar day given as "YYYY-MM-DD". */
export function endOfIstDay(day: string): Date {
  return new Date(`${day}T23:59:59.999${IST_OFFSET}`);
}

/** The last `count` IST months as "YYYY-MM", oldest first, ending with the current one. */
export function lastIstMonths(count: number, now = new Date()): string[] {
  const [year, month] = istDay(now).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

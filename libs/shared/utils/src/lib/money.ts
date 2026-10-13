/**
 * Money is formatted for a locale: "en-IN" by default (the API's CSV
 * statements), or the page's language in the browser. Every Indian locale
 * uses lakh/crore grouping and Latin digits: ₹12,34,567.89.
 */
export const DEFAULT_MONEY_LOCALE = 'en-IN';

const formatters = new Map<string, Intl.NumberFormat>();

/** Creating an Intl formatter is slow; keep one per locale and style. */
function formatter(
  locale: string,
  key: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const id = `${locale}|${key}`;
  let f = formatters.get(id);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatters.set(id, f);
  }
  return f;
}

/** Formats paise as Indian rupees, e.g. 123456789 → "₹12,34,567.89". */
export function formatInr(
  paise: number,
  locale: string = DEFAULT_MONEY_LOCALE,
): string {
  return formatter(locale, 'inr', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Converts a rupee amount typed by a user (e.g. 1050.5) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Short rupee amounts for chart axes: 8500000 paise → "₹85K" in English,
 * "₹85 हज़ार" in Hindi; 1.2 lakh → "₹1.2L" / "₹1.2 लाख".
 */
export function formatInrCompact(
  paise: number,
  locale: string = DEFAULT_MONEY_LOCALE,
): string {
  const compact = formatter(locale, 'compact', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return `₹${compact.format(paise / 100)}`;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as Indian rupees, e.g. 123456789 → "₹12,34,567.89". */
export function formatInr(paise: number): string {
  return inrFormatter.format(paise / 100);
}

/** Converts a rupee amount typed by a user (e.g. 1050.5) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

const compactFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Short rupee amounts for chart axes: 8500000 paise → "₹85K", 1.2 lakh → "₹1.2L". */
export function formatInrCompact(paise: number): string {
  return `₹${compactFormatter.format(paise / 100)}`;
}

/** A cell that is written as-is (a number we formatted ourselves). */
export class CsvNumber {
  constructor(readonly value: string) {}
}

export type CsvCell = string | CsvNumber;

/**
 * Builds RFC 4180 CSV. Text cells are protected against "CSV injection":
 * spreadsheet apps run cells starting with = + - @ as formulas, so a
 * description like "=HYPERLINK(...)" is prefixed with a quote and shown as text.
 */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(formatCell).join(',')).join('\r\n') + '\r\n';
}

function formatCell(cell: CsvCell): string {
  if (cell instanceof CsvNumber) return cell.value;
  let text = cell;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Paise → "1250.75" / "-1250.75" with integer maths (no float rounding). */
export function paiseToDecimal(paise: number): CsvNumber {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return new CsvNumber(
    `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`,
  );
}

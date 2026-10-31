/** Treat spreadsheet formula prefixes as text, including hidden leading whitespace. */
export function escapeCsvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f\u007f\ufeff]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
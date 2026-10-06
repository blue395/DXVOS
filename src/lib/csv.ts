// One CSV cell, safe to open in Excel or Google Sheets. Pure, so it can be tested.
// Every cell is quoted, and text starting with = + - @ (or a tab / carriage return) gets a
// leading apostrophe, so a name like =HYPERLINK(...) is shown as text, never run as a
// formula ("CSV injection": members and founders type some of what we export).

export function csvCell(v: unknown): string {
  const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

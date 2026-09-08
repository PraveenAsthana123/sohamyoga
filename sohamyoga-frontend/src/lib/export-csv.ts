// Real CSV export helper -- CSV is a standard, Excel/Sheets-openable format
// that needs no new dependency, mirroring how /api/customer/bookings/ical
// hand-builds a standard .ics rather than pulling in a calendar library.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const header = columns.map(c => csvCell(c.header)).join(',');
  const body = rows.map(row => columns.map(c => csvCell(row[c.key])).join(',')).join('\r\n');
  return [header, body].filter(Boolean).join('\r\n');
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}

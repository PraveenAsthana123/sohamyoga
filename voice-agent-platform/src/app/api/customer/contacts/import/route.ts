import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { bulkImportContacts } from '@/domain/customer/repository';

// POST /api/customer/contacts/import -- bulk contact upload. Accepts CSV
// text (a header row with name/email/phone columns, in any order, matched
// case-insensitively). NOTE: true .xlsx binary parsing needs a real parser
// library (e.g. `xlsx`) that is not currently a dependency of this project
// -- not added here to avoid silently pulling in a new dependency. Export
// any Excel sheet to CSV first (File > Save As > CSV in Excel/Google
// Sheets); every row is validated and reported, nothing is silently
// dropped.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  const contentType = req.headers.get('content-type') ?? '';
  let csvText: string;
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required (multipart form field "file").' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only .csv is supported right now. Export your spreadsheet to CSV first (File > Save As > CSV), then upload it.' }, { status: 400 });
    }
    csvText = await file.text();
  } else {
    const body = await req.json().catch(() => null) as { csv?: string } | null;
    if (!body?.csv) return NextResponse.json({ error: 'csv text is required.' }, { status: 400 });
    csvText = body.csv;
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) return NextResponse.json({ error: 'CSV must have a header row plus at least one data row.' }, { status: 400 });

  const header = rows[0].map(h => h.trim().toLowerCase());
  const nameIdx = header.findIndex(h => ['name', 'full_name', 'fullname', 'contact name'].includes(h));
  const emailIdx = header.findIndex(h => h === 'email');
  const phoneIdx = header.findIndex(h => ['phone', 'phone number', 'phone_number'].includes(h));
  if (nameIdx === -1) return NextResponse.json({ error: 'CSV must have a "name" column.' }, { status: 400 });
  if (emailIdx === -1 && phoneIdx === -1) return NextResponse.json({ error: 'CSV must have an "email" and/or "phone" column.' }, { status: 400 });

  const dataRows = rows.slice(1).map(r => ({
    fullName: r[nameIdx] ?? '',
    email: emailIdx >= 0 ? r[emailIdx] : undefined,
    phone: phoneIdx >= 0 ? r[phoneIdx] : undefined,
  }));

  try {
    const result = await bulkImportContacts(auth.principal.id, dataRows);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed.' }, { status: 500 });
  }
}

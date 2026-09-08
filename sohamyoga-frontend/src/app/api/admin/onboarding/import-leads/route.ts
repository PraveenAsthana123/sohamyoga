import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RowResult { row: number; email: string | null; status: 'imported' | 'duplicate' | 'invalid'; reason?: string }

// Real Data Import + Import Validation -- first build. Parses a real CSV
// (name,email,phone columns, header row required), validates each row
// (email format, required field), checks for duplicates against real
// campaign_lead.email, and only inserts genuinely valid new rows -- never
// silently drops or fabricates a "success" count.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { csv?: string } | null;
  if (!body?.csv?.trim()) return Response.json({ error: 'csv is required.' }, { status: 400 });

  const lines = body.csv.trim().split(/\r?\n/);
  if (lines.length < 2) return Response.json({ error: 'CSV must have a header row plus at least one data row.' }, { status: 400 });

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const emailIdx = header.indexOf('email');
  const phoneIdx = header.indexOf('phone');
  if (emailIdx === -1) return Response.json({ error: 'CSV header must include an "email" column.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const results: RowResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cols = raw.split(',').map(c => c.trim());
    const email = cols[emailIdx] || null;
    const rowNum = i + 1;

    if (!email || !EMAIL_RE.test(email)) {
      results.push({ row: rowNum, email, status: 'invalid', reason: 'Missing or malformed email.' });
      continue;
    }
    const existing = await query(`SELECT id FROM campaign_lead WHERE tenant_id = $1 AND email = $2`, [tenantId, email]);
    if (existing.rowCount) {
      results.push({ row: rowNum, email, status: 'duplicate', reason: 'Email already exists in campaign_lead.' });
      continue;
    }
    const name = nameIdx !== -1 ? cols[nameIdx] : '';
    const [firstName, ...rest] = name ? name.split(' ') : [''];
    await query(
      `INSERT INTO campaign_lead (tenant_id, first_name, last_name, email, phone, source_platform, funnel_stage)
       VALUES ($1,$2,$3,$4,$5,'csv_import','new')`,
      [tenantId, firstName || null, rest.join(' ') || null, email, phoneIdx !== -1 ? cols[phoneIdx] || null : null],
    );
    results.push({ row: rowNum, email, status: 'imported' });
  }

  return Response.json({
    importedBy: principal!.email ?? principal!.id,
    totalRows: results.length,
    imported: results.filter(r => r.status === 'imported').length,
    duplicates: results.filter(r => r.status === 'duplicate').length,
    invalid: results.filter(r => r.status === 'invalid').length,
    results,
  }, { status: 201 });
}

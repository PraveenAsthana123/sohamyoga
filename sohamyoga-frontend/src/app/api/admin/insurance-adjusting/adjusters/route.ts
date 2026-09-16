import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const conditions: string[] = ['is_active=true'];
    const vals: unknown[] = [];
    const licenseStatus = searchParams.get('license_status');
    const available = searchParams.get('available');
    if (licenseStatus === 'expiring_soon') {
      conditions.push(`license_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE+90`);
    } else if (licenseStatus === 'expired') {
      conditions.push(`license_expiry < CURRENT_DATE`);
    }
    if (available === 'true') { conditions.push(`status='available'`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT a.*, (SELECT COUNT(*) FROM adj_claims WHERE adjuster_id=a.id AND status NOT IN ('closed','denied','settled')) AS live_claim_count
       FROM adj_adjusters a ${where} ORDER BY a.name`,
      vals
    );
    return Response.json({ adjusters: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.name) return Response.json({ error: 'name required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO adj_adjusters (name, email, phone, aic_license_number, license_class, license_expiry, eando_insurer, eando_expiry, specializations, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [body.name, body.email, body.phone, body.aic_license_number, body.license_class ?? 'independent', body.license_expiry, body.eando_insurer, body.eando_expiry, body.specializations ?? [], body.status ?? 'available', body.notes]
    );
    return Response.json({ adjuster: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

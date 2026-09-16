import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const client_id = searchParams.get('client_id');
  const account_type = searchParams.get('account_type');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (client_id) { conditions.push(`a.client_id = $${idx++}`); params.push(Number(client_id)); }
  if (account_type) { conditions.push(`a.account_type = $${idx++}`); params.push(account_type); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT a.*, fc.name AS client_name
      FROM fa_account a
      JOIN fa_client fc ON fc.id = a.client_id
      ${where}
      ORDER BY a.current_value DESC
      LIMIT 500
    `, params);
    return Response.json({ accounts: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id || !b.account_type || !b.institution) {
    return Response.json({ error: 'client_id, account_type, and institution required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO fa_account
        (client_id, account_type, institution, account_number, current_value,
         book_value, annual_contribution, currency, status, opened_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      Number(b.client_id), b.account_type, b.institution,
      b.account_number || null,
      b.current_value ? Number(b.current_value) : 0,
      b.book_value ? Number(b.book_value) : 0,
      b.annual_contribution ? Number(b.annual_contribution) : null,
      b.currency || 'CAD',
      b.status || 'active',
      b.opened_date || null,
    ]);
    return Response.json({ account: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

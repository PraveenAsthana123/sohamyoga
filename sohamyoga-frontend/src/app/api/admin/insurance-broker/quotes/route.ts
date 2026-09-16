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
  const policy_type = searchParams.get('policy_type');
  const status = searchParams.get('status');
  const insurer = searchParams.get('insurer');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (client_id) { conditions.push(`q.client_id = $${idx++}`); params.push(parseInt(client_id, 10)); }
  if (policy_type && policy_type !== 'all') { conditions.push(`q.policy_type = $${idx++}`); params.push(policy_type); }
  if (status) { conditions.push(`q.status = $${idx++}`); params.push(status); }
  if (insurer) { conditions.push(`q.insurer ILIKE $${idx++}`); params.push(`%${insurer}%`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT q.*, ic.name AS client_name, ic.phone AS client_phone
      FROM insurance_quote q
      JOIN insurance_client ic ON ic.id = q.client_id
      ${where}
      ORDER BY q.created_at DESC
      LIMIT 500
    `, params);
    return Response.json({ quotes: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id || !b.policy_type || !b.insurer) {
    return Response.json({ error: 'client_id, policy_type, and insurer are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO insurance_quote
        (client_id, policy_type, insurer, quoted_premium, coverage_amount, deductible,
         quote_details, status, valid_until, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      b.client_id, b.policy_type, b.insurer, b.quoted_premium || null,
      b.coverage_amount || null, b.deductible || null,
      JSON.stringify(b.quote_details || {}), b.status || 'pending',
      b.valid_until || null, b.notes || null,
    ]);
    return Response.json({ quote: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

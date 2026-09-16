import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const credit_tier = searchParams.get('credit_tier');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }
  if (credit_tier) { conditions.push(`c.credit_tier = $${idx++}`); params.push(credit_tier); }
  if (search) {
    conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.*,
        COUNT(a.id) AS application_count
      FROM mortgage_client c
      LEFT JOIN mortgage_application a ON a.client_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 500
    `, params);
    return Response.json({ clients: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.name?.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO mortgage_client
        (name, email, phone, address, city, province, date_of_birth, sin_last4,
         employment_type, annual_income, co_applicant_income, credit_score, credit_tier,
         total_debt, monthly_obligations, status, source, broker_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      b.name.trim(), b.email || null, b.phone || null, b.address || null,
      b.city || 'Calgary', b.province || 'AB',
      b.date_of_birth || null, b.sin_last4 || null,
      b.employment_type || null,
      b.annual_income ? Number(b.annual_income) : null,
      b.co_applicant_income ? Number(b.co_applicant_income) : null,
      b.credit_score ? Number(b.credit_score) : null,
      b.credit_tier || null,
      b.total_debt ? Number(b.total_debt) : null,
      b.monthly_obligations ? Number(b.monthly_obligations) : null,
      b.status || 'prospect', b.source || null, b.broker_notes || null,
    ]);
    return Response.json({ client: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

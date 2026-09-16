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
  const province = searchParams.get('province');
  const source = searchParams.get('source');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }
  if (province) { conditions.push(`c.province = $${idx++}`); params.push(province); }
  if (source) { conditions.push(`c.source = $${idx++}`); params.push(source); }
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
        COUNT(p.id) AS policy_count,
        json_object_agg(COALESCE(p.policy_type, 'none'), COUNT(p.id)) FILTER (WHERE p.id IS NOT NULL) AS policies_by_type
      FROM insurance_client c
      LEFT JOIN insurance_policy p ON p.client_id = c.id
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
      INSERT INTO insurance_client
        (name, email, phone, address, city, province, date_of_birth, gender, occupation,
         smoker, annual_income, credit_tier, status, source, broker_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      b.name.trim(), b.email || null, b.phone || null, b.address || null,
      b.city || 'Calgary', b.province || 'AB', b.date_of_birth || null,
      b.gender || null, b.occupation || null, b.smoker ?? false,
      b.annual_income || null, b.credit_tier || null,
      b.status || 'prospect', b.source || null, b.broker_notes || null,
    ]);
    return Response.json({ client: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

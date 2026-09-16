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
  const client_id = searchParams.get('client_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }
  if (client_id) { conditions.push(`r.client_id = $${idx++}`); params.push(Number(client_id)); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT r.*, fc.name AS client_name
      FROM fa_recommendation r
      JOIN fa_client fc ON fc.id = r.client_id
      ${where}
      ORDER BY
        CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        r.created_at DESC
      LIMIT 200
    `, params);
    return Response.json({ recommendations: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id || !b.description) {
    return Response.json({ error: 'client_id and description required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO fa_recommendation
        (client_id, recommendation_type, description, products, estimated_impact, priority, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [
      Number(b.client_id),
      b.recommendation_type || null,
      b.description,
      JSON.stringify(b.products || []),
      b.estimated_impact || null,
      b.priority || 'medium',
      b.status || 'pending',
    ]);
    return Response.json({ recommendation: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (type) { conditions.push(`client_type = $${params.length + 1}`); params.push(type); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM id_client ${where} ORDER BY last_name, first_name`, params);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO id_client (first_name, last_name, email, phone, project_address, city, province, client_type, budget_range, project_timeline, family_composition, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [body.first_name, body.last_name, body.email, body.phone, body.project_address,
         body.city ?? 'Calgary', body.province ?? 'AB', body.client_type ?? 'residential',
         body.budget_range, body.project_timeline, body.family_composition, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

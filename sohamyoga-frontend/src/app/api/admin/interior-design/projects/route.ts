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
  const designer = searchParams.get('designer');
  const type = searchParams.get('type');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) { conditions.push(`p.status = $${params.length + 1}`); params.push(status); }
      if (designer) { conditions.push(`p.designer ILIKE $${params.length + 1}`); params.push(`%${designer}%`); }
      if (type) { conditions.push(`p.project_type = $${params.length + 1}`); params.push(type); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT p.*, c.first_name, c.last_name, c.email AS client_email FROM id_project p LEFT JOIN id_client c ON c.id = p.client_id ${where} ORDER BY p.created_at DESC`,
        params
      );
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
        `INSERT INTO id_project (client_id, project_name, project_type, rooms_included, designer, status, total_fee, deposit_paid, budget_furniture, start_date, completion_date, style, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [body.client_id, body.project_name, body.project_type, body.rooms_included ?? [],
         body.designer, body.status ?? 'discovery', body.total_fee, body.deposit_paid ?? 0,
         body.budget_furniture, body.start_date, body.completion_date, body.style, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

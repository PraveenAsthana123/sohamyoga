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
  const pm = searchParams.get('pm');
  const type = searchParams.get('type');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) { conditions.push(`p.status = $${params.length + 1}`); params.push(status); }
      if (pm) { conditions.push(`p.project_manager ILIKE $${params.length + 1}`); params.push(`%${pm}%`); }
      if (type) { conditions.push(`p.project_type = $${params.length + 1}`); params.push(type); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT p.*, c.company_name AS client_name FROM cpm_project p LEFT JOIN cpm_client c ON c.id = p.client_id ${where} ORDER BY p.created_at DESC`,
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
      // Auto-generate project_number: CPM-YYYY-NNN
      const year = new Date().getFullYear();
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) AS n FROM cpm_project WHERE project_number LIKE $1`, [`CPM-${year}-%`]
      );
      const seq = String(parseInt(countRows[0].n, 10) + 1).padStart(3, '0');
      const project_number = `CPM-${year}-${seq}`;

      const { rows } = await client.query(
        `INSERT INTO cpm_project (client_id, project_name, project_number, project_type, city, province, site_address, project_manager, superintendent, status, contract_value, original_start_date, original_completion_date, abca_permit_number, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [body.client_id, body.project_name, project_number, body.project_type,
         body.city ?? 'Calgary', body.province ?? 'AB', body.site_address,
         body.project_manager, body.superintendent, body.status ?? 'bidding',
         body.contract_value, body.original_start_date, body.original_completion_date,
         body.abca_permit_number, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

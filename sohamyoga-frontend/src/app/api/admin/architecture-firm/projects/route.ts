import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const phase = searchParams.get('phase');
  const type = searchParams.get('type');
  const principal = searchParams.get('principal');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (phase) { conditions.push(`p.project_phase = $${params.length + 1}`); params.push(phase); }
      if (type) { conditions.push(`p.project_type = $${params.length + 1}`); params.push(type); }
      if (principal) { conditions.push(`p.principal ILIKE $${params.length + 1}`); params.push(`%${principal}%`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT p.*, c.contact_name AS client_name, c.company_name FROM arch_project p LEFT JOIN arch_client c ON c.id = p.client_id ${where} ORDER BY p.created_at DESC`,
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
      const year = new Date().getFullYear();
      const { rows: countRows } = await client.query(`SELECT COUNT(*) AS n FROM arch_project WHERE project_number LIKE $1`, [`ARCH-${year}-%`]);
      const seq = String(parseInt(countRows[0].n, 10) + 1).padStart(3, '0');
      const project_number = `ARCH-${year}-${seq}`;
      const { rows } = await client.query(
        `INSERT INTO arch_project (client_id, project_name, project_number, project_type, project_phase, principal, project_architect, project_designer, site_address, city, province, gross_area_sqft, floors, contract_type, total_fee, fee_percentage, construction_budget, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [body.client_id, body.project_name, project_number, body.project_type,
         body.project_phase ?? 'schematic_design', body.principal, body.project_architect, body.project_designer,
         body.site_address, body.city ?? 'Calgary', body.province ?? 'AB',
         body.gross_area_sqft, body.floors, body.contract_type ?? 'percentage',
         body.total_fee, body.fee_percentage, body.construction_budget, body.status ?? 'active']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

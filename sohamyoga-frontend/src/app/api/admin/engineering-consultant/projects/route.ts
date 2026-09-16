import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const discipline = searchParams.get('discipline');
  const status = searchParams.get('status');
  const assignedPe = searchParams.get('assigned_pe');
  const peStamp = searchParams.get('pe_stamp_required');
  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (discipline) { conditions.push(`p.discipline=$${vals.length + 1}`); vals.push(discipline); }
  if (status) { conditions.push(`p.status=$${vals.length + 1}`); vals.push(status); }
  if (assignedPe) { conditions.push(`p.assigned_pe ILIKE $${vals.length + 1}`); vals.push(`%${assignedPe}%`); }
  if (peStamp) { conditions.push(`p.pe_stamp_required=$${vals.length + 1}`); vals.push(peStamp === 'true'); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT p.*, c.name AS client_name, (SELECT COUNT(*) FROM engineering_deliverable d WHERE d.project_id=p.id) AS deliverable_count
       FROM engineering_project p JOIN engineering_client c ON c.id=p.client_id ${where} ORDER BY p.created_at DESC`,
      vals
    );
    return Response.json({ projects: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.title || !body?.discipline) return Response.json({ error: 'client_id, title, discipline are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Auto-generate project number
    const { rows: last } = await client.query(`SELECT project_number FROM engineering_project ORDER BY id DESC LIMIT 1`);
    const year = new Date().getFullYear();
    const lastNum = last[0]?.project_number ? parseInt(last[0].project_number.split('-').pop() ?? '0', 10) : 0;
    const projectNumber = `ENG-${year}-${String(lastNum + 1).padStart(3, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO engineering_project (client_id, project_number, title, discipline, project_type, location, description, status, priority, start_date, end_date, contract_value, contract_type, budget_hours, pe_stamp_required, assigned_pe, permit_required, permit_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [body.client_id, projectNumber, body.title, body.discipline, body.project_type, body.location, body.description, body.status ?? 'proposal', body.priority ?? 'normal', body.start_date, body.end_date, body.contract_value, body.contract_type ?? 'lump_sum', body.budget_hours, body.pe_stamp_required ?? false, body.assigned_pe, body.permit_required ?? false, body.permit_number]
    );
    return Response.json({ project: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

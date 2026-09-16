import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const researcher = searchParams.get('researcher');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push(`p.status=$${params.length + 1}`); params.push(status); }
    if (type) { conditions.push(`p.research_type=$${params.length + 1}`); params.push(type); }
    if (researcher) { conditions.push(`p.lead_researcher=$${params.length + 1}`); params.push(researcher); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT p.*, c.company_name FROM mr_project p LEFT JOIN mr_client c ON c.id=p.client_id ${where} ORDER BY p.created_at DESC`,
      params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const year = new Date().getFullYear();
    const { rows: countRow } = await client.query(
      `SELECT COUNT(*)+1 AS n FROM mr_project WHERE project_number LIKE $1`,
      [`MR-${year}-%`]
    );
    const seq = String(parseInt(countRow[0].n)).padStart(3, '0');
    const project_number = `MR-${year}-${seq}`;

    const { rows } = await client.query(
      `INSERT INTO mr_project (client_id, project_name, project_number, research_type, methodology, sample_size_target, target_audience, geographic_scope, status, lead_researcher, project_fee, start_date, fieldwork_start, fieldwork_end, delivery_date, research_questions, key_hypotheses, deliverables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [body.client_id, body.project_name, project_number, body.research_type,
       body.methodology || [], body.sample_size_target || null, body.target_audience,
       body.geographic_scope || 'Calgary', body.status || 'scoping', body.lead_researcher,
       body.project_fee || null, body.start_date || null, body.fieldwork_start || null,
       body.fieldwork_end || null, body.delivery_date || null,
       body.research_questions || [], body.key_hypotheses || [], body.deliverables || []]
    );
    // Increment client total_projects
    await client.query(`UPDATE mr_client SET total_projects = total_projects + 1 WHERE id=$1`, [body.client_id]);
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

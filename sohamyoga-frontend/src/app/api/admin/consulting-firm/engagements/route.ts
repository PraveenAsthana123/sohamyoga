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
    const consultant = searchParams.get('consultant');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push(`e.status=$${params.length + 1}`); params.push(status); }
    if (type) { conditions.push(`e.engagement_type=$${params.length + 1}`); params.push(type); }
    if (consultant) { conditions.push(`e.lead_consultant=$${params.length + 1}`); params.push(consultant); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT e.*, c.company_name, c.industry FROM cf_engagement e LEFT JOIN cf_client c ON c.id=e.client_id ${where} ORDER BY e.created_at DESC`,
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
    // Auto-generate engagement_number CF-YYYY-NNN
    const year = new Date().getFullYear();
    const { rows: countRow } = await client.query(
      `SELECT COUNT(*)+1 AS n FROM cf_engagement WHERE engagement_number LIKE $1`,
      [`CF-${year}-%`]
    );
    const seq = String(parseInt(countRow[0].n)).padStart(3, '0');
    const engagement_number = `CF-${year}-${seq}`;

    const { rows } = await client.query(
      `INSERT INTO cf_engagement (client_id, engagement_name, engagement_number, engagement_type, lead_consultant, team_members, start_date, end_date, status, total_fee, contract_type, hourly_rate, budgeted_hours, description, deliverables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [body.client_id, body.engagement_name, engagement_number, body.engagement_type, body.lead_consultant,
       body.team_members || [], body.start_date || null, body.end_date || null,
       body.status || 'active', body.total_fee || null, body.contract_type || 'fixed',
       body.hourly_rate || null, body.budgeted_hours || null, body.description, body.deliverables || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

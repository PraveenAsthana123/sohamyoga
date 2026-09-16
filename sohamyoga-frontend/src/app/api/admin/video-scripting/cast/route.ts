import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const project = url.searchParams.get('project');
    const confirmed = url.searchParams.get('confirmed');

    let q = 'SELECT * FROM vs_cast WHERE 1=1';
    const vals: unknown[] = [];
    if (project) { vals.push(project); q += ` AND project_name = $${vals.length}`; }
    if (confirmed !== null) { vals.push(confirmed === 'true'); q += ` AND confirmed = $${vals.length}`; }
    q += ' ORDER BY created_at DESC';

    const result = await client.query(q, vals);
    return Response.json({ cast: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_name, role, name, type = 'actor', rate_per_day = 0, availability = [], notes } = body;
    if (!project_name || !role || !name) {
      return Response.json({ error: 'project_name, role, and name are required' }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO vs_cast (project_name, role, name, type, rate_per_day, availability, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_name, role, name, type, rate_per_day, availability, notes]
    );
    return Response.json({ cast_member: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

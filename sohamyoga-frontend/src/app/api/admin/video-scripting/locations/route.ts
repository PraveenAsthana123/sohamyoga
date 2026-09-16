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
    const approved = url.searchParams.get('approved');

    let q = 'SELECT * FROM vs_locations WHERE 1=1';
    const vals: unknown[] = [];
    if (project) { vals.push(project); q += ` AND project_name = $${vals.length}`; }
    if (approved !== null) { vals.push(approved === 'true'); q += ` AND approved = $${vals.length}`; }
    q += ' ORDER BY created_at DESC';

    const result = await client.query(q, vals);
    return Response.json({ locations: result.rows });
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
    const { project_name, location_name, address, type, availability = [], cost_per_day = 0, notes } = body;
    if (!project_name || !location_name) {
      return Response.json({ error: 'project_name and location_name are required' }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO vs_locations (project_name, location_name, address, type, availability, cost_per_day, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_name, location_name, address, type, availability, cost_per_day, notes]
    );
    return Response.json({ location: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

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
    const project_id = searchParams.get('project_id');
    let q = `SELECT sl.*, p.project_name FROM rs_sync_licenses sl LEFT JOIN rs_projects p ON p.id = sl.project_id WHERE 1=1`;
    const params: string[] = [];
    if (project_id) { params.push(project_id); q += ` AND sl.project_id = $${params.length}`; }
    q += ` ORDER BY sl.created_at DESC`;
    const { rows } = await client.query(q, params);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_id, track_name, licensee_name, use_type, territory, license_fee, exclusivity, status, notes } = body;
    if (!track_name) return Response.json({ error: 'track_name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO rs_sync_licenses (project_id, track_name, licensee_name, use_type, territory, license_fee, exclusivity, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [project_id, track_name, licensee_name, use_type, territory, license_fee, exclusivity ?? false, status ?? 'negotiating', notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

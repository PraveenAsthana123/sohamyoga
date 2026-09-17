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
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    let q = `SELECT p.*, c.artist_name FROM rs_projects p LEFT JOIN rs_clients c ON c.id = p.client_id WHERE 1=1`;
    const params: string[] = [];
    if (client_id) { params.push(client_id); q += ` AND p.client_id = $${params.length}`; }
    if (status) { params.push(status); q += ` AND p.status = $${params.length}`; }
    q += ` ORDER BY p.created_at DESC`;
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
    const { client_id, project_name, project_type, genre, status, estimated_hours, hourly_rate, contract_value, isrc_prefix, upc_code, release_date, notes } = body;
    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO rs_projects (client_id, project_name, project_type, genre, status, estimated_hours, hourly_rate, contract_value, isrc_prefix, upc_code, release_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [client_id, project_name, project_type, genre, status ?? 'pre_production', estimated_hours, hourly_rate, contract_value, isrc_prefix, upc_code, release_date || null, notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

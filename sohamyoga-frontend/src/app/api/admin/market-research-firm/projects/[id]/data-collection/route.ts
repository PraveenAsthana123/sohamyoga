import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM mr_data_collection WHERE project_id=$1 ORDER BY created_at DESC`, [params.id]);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO mr_data_collection (project_id, collection_method, status, target_completes, collection_start, collection_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [params.id, body.collection_method, body.status || 'planned', body.target_completes || null,
       body.collection_start || null, body.collection_end || null, body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

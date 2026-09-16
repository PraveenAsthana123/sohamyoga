import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const result = await client.query(
      'SELECT * FROM anim_assets WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return Response.json({ assets: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const { asset_name, asset_type, format, notes } = body;
    if (!asset_name || !asset_type) return Response.json({ error: 'asset_name and asset_type are required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO anim_assets (project_id, asset_name, asset_type, format, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, asset_name, asset_type, format, notes]
    );
    return Response.json({ asset: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

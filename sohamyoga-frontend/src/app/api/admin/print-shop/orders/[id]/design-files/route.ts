import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM ps_design_file WHERE order_id = $1 ORDER BY version DESC, uploaded_at DESC`, [params.id]
    );
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    // Get next version number
    const { rows: verRows } = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_ver FROM ps_design_file WHERE order_id = $1`, [params.id]
    );
    const version = verRows[0].next_ver;
    const { rows } = await client.query(`
      INSERT INTO ps_design_file (order_id, file_name, file_url, file_type, version, is_final, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [params.id, body.file_name, body.file_url ?? null, body.file_type ?? null, version, body.is_final ?? false, body.notes ?? null]);

    // Update order artwork_status
    await client.query(`UPDATE ps_order SET artwork_status = 'received' WHERE id = $1 AND artwork_status = 'awaiting'`, [params.id]);

    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

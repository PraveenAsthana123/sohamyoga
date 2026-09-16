import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  // Send proof — set proof_sent = true
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ps_order SET proof_sent = true, status = 'artwork_review' WHERE id = $1 RETURNING *`, [params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  // Approve proof — set proof_approved = true, advance to pre_press
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ps_order SET proof_approved = true, artwork_status = 'final', status = 'pre_press' WHERE id = $1 RETURNING *`, [params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}

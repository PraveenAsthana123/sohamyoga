import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { duration_minutes, materials_cost, tip_amount, quality_rating, notes, payment_status } = body;
    const { rows } = await client.query(`
      UPDATE ls_job SET
        status = 'completed',
        duration_minutes = COALESCE($2, duration_minutes),
        materials_cost = COALESCE($3, materials_cost),
        tip_amount = COALESCE($4, tip_amount),
        quality_rating = COALESCE($5, quality_rating),
        notes = COALESCE($6, notes),
        payment_status = COALESCE($7, payment_status)
      WHERE id = $1 RETURNING *
    `, [params.id, duration_minutes ?? null, materials_cost ?? null, tip_amount ?? null, quality_rating ?? null, notes ?? null, payment_status ?? 'invoiced']);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const id = parseInt(params.id);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [cRes, snapRes, goalRes, insRes] = await Promise.all([
        client.query(`SELECT * FROM wm_client WHERE id=$1`, [id]),
        client.query(`SELECT * FROM wm_financial_snapshot WHERE client_id=$1 ORDER BY snapshot_date DESC LIMIT 5`, [id]),
        client.query(`SELECT * FROM wm_goal WHERE client_id=$1 ORDER BY priority DESC, created_at DESC`, [id]),
        client.query(`SELECT * FROM wm_insurance_review WHERE client_id=$1 ORDER BY review_date DESC LIMIT 1`, [id]),
      ]);
      if (!cRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({
        ...cRes.rows[0],
        snapshots: snapRes.rows,
        goals: goalRes.rows,
        latest_insurance_review: insRes.rows[0] || null,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const id = parseInt(params.id);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(', ');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(
        `UPDATE wm_client SET ${sets} WHERE id=$1 RETURNING *`,
        [id, ...vals]
      );
      return NextResponse.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

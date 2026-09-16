import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT g.*, c.first_name, c.last_name FROM wm_goal g JOIN wm_client c ON c.id=g.client_id WHERE g.id=$1`,
        [parseInt(params.id)]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(rows[0]);
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
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Auto-set status to completed if current_amount >= target_amount
      let updates = { ...body };
      if (updates.current_amount !== undefined && updates.target_amount === undefined) {
        const existing = await client.query(`SELECT target_amount FROM wm_goal WHERE id=$1`, [parseInt(params.id)]);
        if (existing.rows.length) {
          const target = parseFloat(existing.rows[0].target_amount);
          if (parseFloat(updates.current_amount) >= target) updates.status = 'completed';
        }
      }
      const fields = Object.keys(updates).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(', ');
      const vals = fields.map(k => updates[k]);
      const { rows } = await client.query(
        `UPDATE wm_goal SET ${sets} WHERE id=$1 RETURNING *`,
        [parseInt(params.id), ...vals]
      );
      return NextResponse.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

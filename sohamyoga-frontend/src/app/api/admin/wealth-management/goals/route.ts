import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT g.*, c.first_name, c.last_name FROM wm_goal g JOIN wm_client c ON c.id=g.client_id WHERE 1=1`;
      const params: any[] = [];
      if (client_id) { params.push(parseInt(client_id)); q += ` AND g.client_id=$${params.length}`; }
      if (status) { params.push(status); q += ` AND g.status=$${params.length}`; }
      q += ` ORDER BY g.priority DESC, g.created_at DESC`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO wm_goal (client_id, goal_name, goal_type, target_amount, current_amount, target_date, monthly_contribution, priority, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [body.client_id, body.goal_name, body.goal_type, body.target_amount||null, body.current_amount||0,
          body.target_date||null, body.monthly_contribution||null, body.priority||'medium', body.status||'active', body.notes||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

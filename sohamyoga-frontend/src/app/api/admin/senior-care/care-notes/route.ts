import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const client_id = searchParams.get('client_id');
      const date = searchParams.get('date');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (client_id) { vals.push(parseInt(client_id)); conditions.push(`cn.client_id=$${vals.length}`); }
      if (date) { vals.push(date); conditions.push(`cn.visit_date=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT cn.*, c.first_name AS client_first, c.last_name AS client_last,
          cg.first_name AS cg_first, cg.last_name AS cg_last
        FROM sc_care_note cn
        LEFT JOIN sc_client c ON c.id=cn.client_id
        LEFT JOIN sc_caregiver cg ON cg.id=cn.caregiver_id
        ${where}
        ORDER BY cn.visit_date DESC, cn.created_at DESC
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { client_id, caregiver_id, visit_date, mood, appetite, mobility, medications_taken = true, incidents, activities_completed = [], general_notes } = body;
    if (!client_id || !visit_date) return Response.json({ error: 'client_id, visit_date required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO sc_care_note (client_id, caregiver_id, visit_date, mood, appetite, mobility, medications_taken, incidents, activities_completed, general_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [client_id, caregiver_id || null, visit_date, mood, appetite, mobility, medications_taken, incidents, activities_completed, general_notes]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

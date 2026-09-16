import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const child_id = searchParams.get('child_id');
  const date = searchParams.get('date');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (child_id) { conds.push(`r.child_id = $${i++}`); vals.push(child_id); }
      if (date) { conds.push(`r.report_date = $${i++}`); vals.push(date); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT r.*, c.name AS child_name, c.room_name FROM cc_daily_report r LEFT JOIN cc_child c ON c.id = r.child_id ${where} ORDER BY r.report_date DESC`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO cc_daily_report (child_id, report_date, meals, nap_start, nap_end, nap_quality, mood, activities, toileting_notes, diaper_changes, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [body.child_id, body.report_date || new Date().toISOString().split('T')[0],
         JSON.stringify(body.meals ?? {}), body.nap_start, body.nap_end, body.nap_quality,
         body.mood, body.activities ?? [], body.toileting_notes, body.diaper_changes,
         body.notes, body.created_by ?? 'Staff']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

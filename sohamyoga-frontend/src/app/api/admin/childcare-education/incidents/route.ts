import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const requires_licensing = searchParams.get('requires_licensing');
  const from = searchParams.get('from');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (type) { conds.push(`i.type = $${i++}`); vals.push(type); }
      if (requires_licensing === 'true') { conds.push(`i.requires_licensing_report = true`); }
      if (from) { conds.push(`i.incident_date >= $${i++}`); vals.push(from); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT i.*, c.name AS child_name, c.parent1_name, c.parent1_phone
         FROM cc_incident i LEFT JOIN cc_child c ON c.id = i.child_id
         ${where} ORDER BY i.incident_date DESC, i.incident_time DESC`,
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
        `INSERT INTO cc_incident (child_id, incident_date, incident_time, type, description, action_taken, reported_by, witness, requires_licensing_report)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [body.child_id, body.incident_date || new Date().toISOString().split('T')[0],
         body.incident_time, body.type, body.description, body.action_taken,
         body.reported_by, body.witness, body.requires_licensing_report ?? false]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

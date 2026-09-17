import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get('project_id');
    const date = searchParams.get('date');
    let q = `SELECT s.*, p.project_name FROM rs_sessions s LEFT JOIN rs_projects p ON p.id = s.project_id WHERE 1=1`;
    const params: string[] = [];
    if (project_id) { params.push(project_id); q += ` AND s.project_id = $${params.length}`; }
    if (date) { params.push(date); q += ` AND s.session_date = $${params.length}`; }
    q += ` ORDER BY s.session_date DESC, s.start_time DESC`;
    const { rows } = await client.query(q, params);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_id, studio_room, engineer_name, session_date, start_time, end_time, session_type, tracks_recorded, notes } = body;
    if (!session_date) return Response.json({ error: 'session_date is required' }, { status: 400 });
    let hours_logged = 0;
    if (start_time && end_time) {
      const [sh, sm] = start_time.split(':').map(Number);
      const [eh, em] = end_time.split(':').map(Number);
      hours_logged = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    }
    const { rows } = await client.query(
      `INSERT INTO rs_sessions (project_id, studio_room, engineer_name, session_date, start_time, end_time, hours_logged, session_type, tracks_recorded, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [project_id, studio_room, engineer_name, session_date, start_time || null, end_time || null, hours_logged, session_type, tracks_recorded ?? [], notes]
    );
    if (project_id && hours_logged > 0) {
      await client.query(`UPDATE rs_projects SET actual_hours = actual_hours + $1 WHERE id = $2`, [hours_logged, project_id]);
    }
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

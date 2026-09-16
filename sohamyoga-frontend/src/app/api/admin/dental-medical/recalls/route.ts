import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'overdue'; // overdue, upcoming, all
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      let where = '';
      if (type === 'overdue') where = `WHERE r.due_date < CURRENT_DATE AND r.status = 'pending'`;
      else if (type === 'upcoming') where = `WHERE r.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND r.status = 'pending'`;
      const { rows } = await client.query(
        `SELECT r.*, p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email, p.preferred_provider
         FROM clinic_recall r
         LEFT JOIN clinic_patient p ON p.id = r.patient_id
         ${where} ORDER BY r.due_date ASC`,
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
        `INSERT INTO clinic_recall (patient_id, recall_type, due_date, status) VALUES ($1,$2,$3,$4) RETURNING *`,
        [body.patient_id, body.recall_type ?? 'cleaning', body.due_date, body.status ?? 'pending']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

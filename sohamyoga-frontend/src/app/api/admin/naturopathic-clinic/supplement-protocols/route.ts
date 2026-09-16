import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const patient_id = searchParams.get('patient_id');
    const vals: unknown[] = [];
    const where = patient_id ? `WHERE sp.patient_id = $1` : '';
    if (patient_id) vals.push(patient_id);
    const { rows } = await client.query(
      `SELECT sp.*, p.first_name, p.last_name FROM nd_supplement_protocol sp JOIN nd_patient p ON p.id = sp.patient_id ${where} ORDER BY sp.created_at DESC`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO nd_supplement_protocol (patient_id, naturopath, created_date, health_goals, protocol_name, supplements, dietary_protocol, lifestyle_protocol, status, next_review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [b.patient_id, b.naturopath || null, b.created_date || null, b.health_goals || null, b.protocol_name || null, JSON.stringify(b.supplements || []), b.dietary_protocol || null, b.lifestyle_protocol || null, b.status || 'active', b.next_review_date || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

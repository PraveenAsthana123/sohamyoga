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
    const date = searchParams.get('date');
    const naturopath = searchParams.get('naturopath');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (date) { conditions.push(`v.visit_date = $${idx++}`); vals.push(date); }
    if (naturopath) { conditions.push(`v.naturopath = $${idx++}`); vals.push(naturopath); }
    if (type) { conditions.push(`v.visit_type = $${idx++}`); vals.push(type); }
    if (status) { conditions.push(`v.status = $${idx++}`); vals.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT v.id, v.patient_id, v.naturopath, v.visit_date, v.visit_time, v.visit_type, v.status, v.fee, v.extended_health_claimed, v.patient_paid, p.first_name, p.last_name, p.extended_health_provider
       FROM nd_visit v JOIN nd_patient p ON p.id = v.patient_id
       ${where} ORDER BY v.visit_date DESC, v.visit_time DESC`,
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
      `INSERT INTO nd_visit (patient_id, naturopath, visit_date, visit_time, visit_type, status, fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.patient_id, b.naturopath, b.visit_date, b.visit_time, b.visit_type || 'follow_up', b.status || 'scheduled', b.fee || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

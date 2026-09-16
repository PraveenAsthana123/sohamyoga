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
    const practitioner = searchParams.get('practitioner');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (date) { conditions.push(`t.treatment_date = $${idx++}`); vals.push(date); }
    if (practitioner) { conditions.push(`t.practitioner = $${idx++}`); vals.push(practitioner); }
    if (type) { conditions.push(`t.treatment_type = $${idx++}`); vals.push(type); }
    if (status) { conditions.push(`t.status = $${idx++}`); vals.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT t.*, p.first_name, p.last_name, p.chief_complaint, p.mva_claim_number, p.extended_health_provider
       FROM tcm_treatment t
       JOIN tcm_patient p ON p.id = t.patient_id
       ${where}
       ORDER BY t.treatment_date DESC, t.treatment_time DESC`,
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
      `INSERT INTO tcm_treatment (patient_id, practitioner, treatment_date, treatment_time, treatment_type, status, fee, mva_claimed, extended_health_claimed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.patient_id, b.practitioner, b.treatment_date, b.treatment_time, b.treatment_type || 'acupuncture', b.status || 'scheduled', b.fee || null, b.mva_claimed || null, b.extended_health_claimed || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

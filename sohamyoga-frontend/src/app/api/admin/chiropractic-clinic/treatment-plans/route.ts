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
    const patient_id = searchParams.get('patient_id');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (patient_id) { params.push(parseInt(patient_id)); conditions.push(`tp.patient_id=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT tp.*, p.first_name, p.last_name,
              (SELECT COUNT(*) FROM chiro_visit v WHERE v.patient_id=tp.patient_id AND v.status='completed') AS completed_visits
       FROM chiro_treatment_plan tp JOIN chiro_patient p ON p.id=tp.patient_id
       ${where} ORDER BY tp.created_at DESC`, params
    );
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
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO chiro_treatment_plan (patient_id,chiropractor,created_date,diagnosis,treatment_frequency,
        proposed_visits,duration_weeks,techniques,goals,mva_pre_authorized,wca_pre_authorized,auth_visits,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.patient_id,b.chiropractor,b.created_date||null,b.diagnosis,b.treatment_frequency||null,
       b.proposed_visits||null,b.duration_weeks||null,b.techniques||null,b.goals||null,
       b.mva_pre_authorized||false,b.wca_pre_authorized||false,b.auth_visits||null,b.status||'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

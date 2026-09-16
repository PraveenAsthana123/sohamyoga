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
    const date = searchParams.get('date');
    const chiropractor = searchParams.get('chiropractor');
    const status = searchParams.get('status');
    const patient_id = searchParams.get('patient_id');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (date) { params.push(date); conditions.push(`v.visit_date=$${params.length}`); }
    if (chiropractor) { params.push(chiropractor); conditions.push(`v.chiropractor=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`v.status=$${params.length}`); }
    if (patient_id) { params.push(parseInt(patient_id)); conditions.push(`v.patient_id=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT v.*, p.first_name, p.last_name, p.primary_complaint, p.mva_claim_number, p.wca_claim_number, p.extended_health_provider
       FROM chiro_visit v JOIN chiro_patient p ON p.id=v.patient_id
       ${where} ORDER BY v.visit_date DESC, v.visit_time DESC LIMIT 200`, params
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
      `INSERT INTO chiro_visit (patient_id,chiropractor,visit_date,visit_time,visit_type,status,fee)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.patient_id,b.chiropractor,b.visit_date,b.visit_time,b.visit_type||'treatment',b.status||'scheduled',b.fee||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

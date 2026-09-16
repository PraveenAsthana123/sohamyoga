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
    const status = searchParams.get('status');
    const referral = searchParams.get('referral');
    const chiropractor = searchParams.get('chiropractor');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`p.status=$${params.length}`); }
    if (referral) { params.push(referral); conditions.push(`p.referral_source=$${params.length}`); }
    if (chiropractor) { params.push(chiropractor); conditions.push(`p.chiropractor=$${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(p.first_name ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR p.phone ILIKE $${params.length} OR p.primary_complaint ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT p.*, COUNT(v.id) AS visit_count FROM chiro_patient p
       LEFT JOIN chiro_visit v ON v.patient_id=p.id
       ${where} GROUP BY p.id ORDER BY p.created_at DESC`, params
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
      `INSERT INTO chiro_patient (first_name,last_name,date_of_birth,health_card_number,phone,email,address,city,province,
        referral_source,primary_complaint,secondary_complaints,pain_level,duration_of_complaint,onset_type,
        previous_chiro_care,contraindications,medications,health_conditions,
        mva_claim_number,wca_claim_number,extended_health_provider,extended_health_id,coverage_per_visit,chiropractor,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [b.first_name,b.last_name,b.date_of_birth||null,b.health_card_number||null,b.phone,b.email||null,b.address||null,
       b.city||'Calgary',b.province||'AB',b.referral_source||null,b.primary_complaint,
       b.secondary_complaints||null,b.pain_level||null,b.duration_of_complaint||null,b.onset_type||null,
       b.previous_chiro_care||false,b.contraindications||null,b.medications||null,b.health_conditions||null,
       b.mva_claim_number||null,b.wca_claim_number||null,b.extended_health_provider||null,
       b.extended_health_id||null,b.coverage_per_visit||null,b.chiropractor||null,b.status||'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

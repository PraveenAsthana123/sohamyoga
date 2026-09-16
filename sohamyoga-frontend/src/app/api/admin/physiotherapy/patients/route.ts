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
    const referralSource = searchParams.get('referral_source') ?? '';
    const status = searchParams.get('status') ?? '';
    const search = searchParams.get('search') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (referralSource) { vals.push(referralSource); where += ` AND referral_source = $${vals.length}`; }
    if (status) { vals.push(status); where += ` AND status = $${vals.length}`; }
    if (search) { vals.push(`%${search}%`); where += ` AND (first_name ILIKE $${vals.length} OR last_name ILIKE $${vals.length} OR primary_diagnosis ILIKE $${vals.length})`; }
    const { rows } = await client.query(`SELECT * FROM pt_patient ${where} ORDER BY created_at DESC LIMIT 200`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO pt_patient (first_name, last_name, date_of_birth, health_card_number, phone, email, address, city, province, referral_source, referring_physician, physician_fax, injury_type, primary_diagnosis, secondary_diagnoses, date_of_injury, wca_claim_number, wca_approved, mvac_claim_number, group_benefits_provider, group_benefits_id, treatment_goals, precautions, contraindications, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth ?? null, b.health_card_number ?? null, b.phone, b.email ?? null, b.address ?? null, b.city ?? 'Calgary', b.province ?? 'AB', b.referral_source ?? null, b.referring_physician ?? null, b.physician_fax ?? null, b.injury_type ?? null, b.primary_diagnosis ?? null, b.secondary_diagnoses ?? null, b.date_of_injury ?? null, b.wca_claim_number ?? null, b.wca_approved ?? null, b.mvac_claim_number ?? null, b.group_benefits_provider ?? null, b.group_benefits_id ?? null, b.treatment_goals ?? null, b.precautions ?? null, b.contraindications ?? null, b.status ?? 'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

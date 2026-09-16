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
    const funding = searchParams.get('funding');
    const ot = searchParams.get('ot');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`c.status=$${params.length}`); }
    if (funding) { params.push(funding); conditions.push(`c.funding_source=$${params.length}`); }
    if (ot) { params.push(ot); conditions.push(`c.ot=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT c.*,
              COUNT(s.id) AS session_count,
              COUNT(g.id) FILTER (WHERE g.status='active') AS active_goals,
              COUNT(g.id) FILTER (WHERE g.status='achieved') AS achieved_goals,
              COUNT(m.id) FILTER (WHERE m.status NOT IN ('installed','declined')) AS pending_modifications
       FROM ot_client c
       LEFT JOIN ot_session s ON s.client_id=c.id
       LEFT JOIN ot_goal g ON g.client_id=c.id
       LEFT JOIN ot_home_modification m ON m.client_id=c.id
       ${where} GROUP BY c.id ORDER BY c.created_at DESC`, params
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
      `INSERT INTO ot_client (first_name,last_name,date_of_birth,health_card_number,phone,parent_name,parent_phone,email,
        city,province,referral_source,diagnosis,occupational_concerns,areas_of_focus,setting,ot,
        funding_source,wca_claim,aish_file_number,extended_health_provider,
        home_assessment_required,assistive_devices,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [b.first_name,b.last_name,b.date_of_birth,b.health_card_number||null,
       b.phone||null,b.parent_name||null,b.parent_phone||null,b.email||null,
       b.city||'Calgary',b.province||'AB',b.referral_source||null,
       b.diagnosis||null,b.occupational_concerns||null,b.areas_of_focus||null,
       b.setting||'clinic',b.ot||null,b.funding_source||'private_pay',
       b.wca_claim||null,b.aish_file_number||null,b.extended_health_provider||null,
       b.home_assessment_required||false,b.assistive_devices||null,b.status||'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

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
    const slp = searchParams.get('slp');
    const funding = searchParams.get('funding');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`c.status=$${params.length}`); }
    if (slp) { params.push(slp); conditions.push(`c.slp=$${params.length}`); }
    if (funding === 'aish') { conditions.push(`c.aish_funded=true`); }
    else if (funding === 'cbs') { conditions.push(`c.cbs_funded=true`); }
    else if (funding === 'extended') { conditions.push(`c.extended_health_provider IS NOT NULL`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT c.*, COUNT(s.id) AS session_count,
              COUNT(g.id) FILTER (WHERE g.status='active') AS active_goals,
              COUNT(g.id) FILTER (WHERE g.status='mastered') AS mastered_goals
       FROM st_client c
       LEFT JOIN st_session s ON s.client_id=c.id
       LEFT JOIN st_goal g ON g.client_id=c.id
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
      `INSERT INTO st_client (first_name,last_name,date_of_birth,health_card_number,phone,parent_name,parent_phone,parent_email,
        city,province,referral_source,referring_professional,primary_diagnosis,communication_goals,areas_of_focus,
        session_type,frequency,slp,alberta_health_covered,aish_funded,cbs_funded,
        extended_health_provider,extended_health_id,status,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
      [b.first_name,b.last_name,b.date_of_birth,b.health_card_number||null,b.phone||null,
       b.parent_name||null,b.parent_phone,b.parent_email||null,
       b.city||'Calgary',b.province||'AB',b.referral_source||null,b.referring_professional||null,
       b.primary_diagnosis||null,b.communication_goals||null,b.areas_of_focus||null,
       b.session_type||'individual',b.frequency||'weekly',b.slp||null,
       b.alberta_health_covered||false,b.aish_funded||false,b.cbs_funded||false,
       b.extended_health_provider||null,b.extended_health_id||null,b.status||'active',b.notes||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

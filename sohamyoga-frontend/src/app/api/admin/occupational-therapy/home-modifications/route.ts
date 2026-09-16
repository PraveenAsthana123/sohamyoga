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
    const client_id = searchParams.get('client_id');
    const risk_level = searchParams.get('risk_level');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (client_id) { params.push(parseInt(client_id)); conditions.push(`m.client_id=$${params.length}`); }
    if (risk_level) { params.push(risk_level); conditions.push(`m.risk_level=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`m.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT m.*, c.first_name, c.last_name FROM ot_home_modification m
       JOIN ot_client c ON c.id=m.client_id ${where}
       ORDER BY CASE m.risk_level WHEN 'immediate' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, m.created_at DESC`, params
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
      `INSERT INTO ot_home_modification (client_id,assessment_date,ot,room,modification_type,risk_level,
        recommended_equipment,estimated_cost,funded_by,installation_required,status,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.client_id,b.assessment_date||null,b.ot||null,b.room||null,b.modification_type,
       b.risk_level||'medium',b.recommended_equipment||null,b.estimated_cost||null,
       b.funded_by||null,b.installation_required||false,b.status||'recommended',b.notes||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

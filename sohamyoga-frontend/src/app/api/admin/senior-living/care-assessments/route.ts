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
    const resident_id = searchParams.get('resident_id');
    const assessment_type = searchParams.get('assessment_type');
    const date = searchParams.get('date');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (resident_id) { conditions.push(`a.resident_id = $${idx++}`); vals.push(resident_id); }
    if (assessment_type) { conditions.push(`a.assessment_type = $${idx++}`); vals.push(assessment_type); }
    if (date) { conditions.push(`a.assessment_date = $${idx++}`); vals.push(date); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT a.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM sl_care_assessments a JOIN sl_residents r ON r.id = a.resident_id
       ${where} ORDER BY a.assessment_date DESC, a.created_at DESC`, vals
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
    const { rows } = await client.query(`
      INSERT INTO sl_care_assessments (resident_id, assessment_type, assessed_by, assessment_date, score, risk_level, recommendations, next_assessment_due)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.resident_id, b.assessment_type, b.assessed_by, b.assessment_date || null, b.score || null, b.risk_level, b.recommendations || [], b.next_assessment_due || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

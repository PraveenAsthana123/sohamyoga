export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const rows = await client.query(`SELECT * FROM hr_interview WHERE applicant_id=$1 ORDER BY scheduled_at DESC`, [params.id]);
    return Response.json({ interviews: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { interview_type, scheduled_at, duration_minutes, interviewer, location } = body;
    if (!scheduled_at) return Response.json({ error: 'scheduled_at required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO hr_interview (applicant_id,interview_type,scheduled_at,duration_minutes,interviewer,location)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [params.id, interview_type||'phone', scheduled_at, duration_minutes||60, interviewer, location]);

    return Response.json({ interview: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

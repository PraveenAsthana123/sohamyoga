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
    const r = await client.query(`SELECT *, vacation_days_total - vacation_days_used AS vacation_remaining FROM hr_employee WHERE id=$1`, [params.id]);
    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ employee: r.rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const fields = ['name','email','phone','department','job_title','noc_code','employment_type','start_date','end_date','salary','pay_frequency','status','manager','location','vacation_days_total','vacation_days_used','emergency_contact','emergency_phone','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE hr_employee SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ employee: r.rows[0] });
  } finally {
    client.release();
  }
}

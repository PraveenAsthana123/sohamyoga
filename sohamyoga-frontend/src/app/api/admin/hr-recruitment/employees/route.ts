export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const dept = searchParams.get('department');
  const status = searchParams.get('status');
  const type = searchParams.get('employment_type');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (dept) { where.push(`department ILIKE $${i++}`); params.push(`%${dept}%`); }
    if (status) { where.push(`status=$${i++}`); params.push(status); }
    if (type) { where.push(`employment_type=$${i++}`); params.push(type); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT *, vacation_days_total - vacation_days_used AS vacation_remaining
      FROM hr_employee ${wStr}
      ORDER BY name LIMIT 300
    `, params);

    return Response.json({ employees: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, email, phone, department, job_title, noc_code, employment_type, start_date,
      salary, pay_frequency, sin_last4, date_of_birth, status, manager, location,
      vacation_days_total, emergency_contact, emergency_phone, notes } = body;

    if (!name) return Response.json({ error: 'name required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO hr_employee (name,email,phone,department,job_title,noc_code,employment_type,start_date,
        salary,pay_frequency,sin_last4,date_of_birth,status,manager,location,
        vacation_days_total,emergency_contact,emergency_phone,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *
    `, [name,email,phone,department,job_title,noc_code,employment_type||'full_time',start_date,
        salary,pay_frequency||'bi_weekly',sin_last4,date_of_birth,status||'active',manager,location,
        vacation_days_total||10,emergency_contact,emergency_phone,notes]);

    return Response.json({ employee: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

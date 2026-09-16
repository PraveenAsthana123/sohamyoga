import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_member (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, phone TEXT, company TEXT, job_title TEXT,
        membership_plan TEXT DEFAULT 'hot_desk'
          CHECK (membership_plan IN ('day_pass','hot_desk','dedicated_desk','private_office','virtual_office','meeting_room_only')),
        membership_status TEXT DEFAULT 'active' CHECK (membership_status IN ('active','paused','cancelled')),
        start_date DATE NOT NULL DEFAULT CURRENT_DATE, billing_cycle TEXT DEFAULT 'monthly',
        monthly_rate DECIMAL(10,2), desk_number TEXT,
        printer_access BOOLEAN DEFAULT true, mail_service BOOLEAN DEFAULT false,
        "24hr_access" BOOLEAN DEFAULT false, storage_locker TEXT,
        emergency_contact TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get('plan');
  const status = searchParams.get('status');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (plan) { conditions.push(`membership_plan = $${idx++}`); values.push(plan); }
  if (status) { conditions.push(`membership_status = $${idx++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM cw_member ${where} ORDER BY created_at DESC LIMIT 200`,
      values
    );
    return Response.json({ members: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const {
    first_name, last_name, email, phone, company, job_title,
    membership_plan = 'hot_desk', billing_cycle = 'monthly',
    monthly_rate, desk_number, printer_access = true, mail_service = false,
    access_24hr = false, storage_locker, emergency_contact, notes,
  } = body;
  if (!first_name || !last_name || !email) {
    return Response.json({ error: 'first_name, last_name, and email are required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO cw_member (first_name, last_name, email, phone, company, job_title,
        membership_plan, billing_cycle, monthly_rate, desk_number,
        printer_access, mail_service, "24hr_access", storage_locker, emergency_contact, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [first_name, last_name, email, phone, company, job_title,
       membership_plan, billing_cycle, monthly_rate, desk_number,
       printer_access, mail_service, access_24hr, storage_locker, emergency_contact, notes]
    );
    return Response.json({ member: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

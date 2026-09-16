import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const date = url.searchParams.get('date');
  const upcoming = url.searchParams.get('upcoming');

  const conditions: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`status=$${idx++}`); vals.push(status); }
  if (date) { conditions.push(`DATE(appointment_at)=$${idx++}`); vals.push(date); }
  if (upcoming === 'true') { conditions.push(`appointment_at > NOW()`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM appointment_reminders ${where} ORDER BY appointment_at ASC`,
    vals,
  );
  return Response.json({ appointments: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.appointment_at) return Response.json({ error: 'appointment_at required' }, { status: 400 });
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO appointment_reminders
      (customer_name, customer_email, customer_phone, appointment_type,
       appointment_at, location, meeting_url, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      body.customer_name || null, body.customer_email || null, body.customer_phone || null,
      body.appointment_type || null, body.appointment_at,
      body.location || null, body.meeting_url || null, body.notes || null,
    ],
  );
  return Response.json({ appointment: rows[0] }, { status: 201 });
}

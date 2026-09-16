import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const venue_id = searchParams.get('venue_id') ?? '';
  const year = searchParams.get('year') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) { conditions.push(`b.status=$${values.length+1}`); values.push(status); }
    if (venue_id) { conditions.push(`b.venue_id=$${values.length+1}`); values.push(venue_id); }
    if (year) { conditions.push(`EXTRACT(YEAR FROM b.event_date)=$${values.length+1}`); values.push(year); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const r = await client.query(
      `SELECT b.*,v.venue_name,v.venue_type
       FROM wv_booking b LEFT JOIN wv_venue v ON v.id=b.venue_id
       ${where} ORDER BY b.event_date DESC`,
      values
    );
    return Response.json({ bookings: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Check venue date availability
    if (body.venue_id) {
      const conflict = await client.query(
        `SELECT id FROM wv_booking WHERE venue_id=$1 AND event_date=$2 AND status NOT IN ('cancelled')`,
        [body.venue_id, body.event_date]
      );
      if (conflict.rows.length) {
        return Response.json({ error: 'Venue is already booked on this date' }, { status: 409 });
      }
    }

    const r = await client.query(
      `INSERT INTO wv_booking (venue_id,couple_name1,couple_name2,contact_email,contact_phone,event_date,ceremony_time,reception_time,guest_count,event_type,total_package_price,deposit_amount,balance_due,ceremony_included,catering_included,catering_provider,florist,photographer,wedding_coordinator,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [body.venue_id||null,body.couple_name1,body.couple_name2||null,
       body.contact_email,body.contact_phone,body.event_date,
       body.ceremony_time||null,body.reception_time||null,body.guest_count,
       body.event_type||'wedding',body.total_package_price||null,
       body.deposit_amount||null,body.balance_due||null,
       body.ceremony_included??true,body.catering_included??false,
       body.catering_provider||null,body.florist||null,body.photographer||null,
       body.wedding_coordinator||null,body.notes||null]
    );
    return Response.json({ booking: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

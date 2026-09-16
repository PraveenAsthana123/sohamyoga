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
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_space (
        id SERIAL PRIMARY KEY, space_name TEXT NOT NULL, space_type TEXT NOT NULL
          CHECK (space_type IN ('hot_desk','dedicated_desk','private_office','meeting_room','phone_booth','event_space','lounge')),
        capacity INTEGER DEFAULT 1, floor TEXT, amenities TEXT[],
        hourly_rate DECIMAL(10,2), daily_rate DECIMAL(10,2), monthly_rate DECIMAL(10,2),
        is_available BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_booking (
        id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES cw_member(id),
        space_id INTEGER REFERENCES cw_space(id),
        booking_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
        status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')),
        attendees INTEGER DEFAULT 1, purpose TEXT, amount_charged DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_visitor (
        id SERIAL PRIMARY KEY, host_member_id INTEGER REFERENCES cw_member(id),
        visitor_name TEXT NOT NULL, visitor_company TEXT, visit_purpose TEXT,
        scheduled_at TIMESTAMPTZ, checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ,
        badge_number TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [members, spaces, revenue, visitors] = await Promise.all([
      client.query(`SELECT COUNT(*) AS active_members FROM cw_member WHERE membership_status = 'active'`),
      client.query(`
        SELECT COUNT(*) AS spaces_occupied_today
        FROM cw_booking b
        WHERE b.booking_date = CURRENT_DATE
          AND b.status IN ('confirmed','checked_in')
      `),
      client.query(`
        SELECT COALESCE(SUM(amount_charged),0) AS revenue_mtd
        FROM cw_booking
        WHERE date_trunc('month', booking_date) = date_trunc('month', CURRENT_DATE)
          AND status = 'completed'
      `),
      client.query(`
        SELECT COUNT(*) AS visitors_today
        FROM cw_visitor
        WHERE DATE(scheduled_at) = CURRENT_DATE OR DATE(checked_in_at) = CURRENT_DATE
      `),
    ]);
    const hotDesks = await client.query(`
      SELECT COUNT(*) AS hot_desks_available
      FROM cw_space
      WHERE space_type = 'hot_desk' AND is_available = true
    `);
    return Response.json({
      active_members: parseInt(members.rows[0].active_members),
      spaces_occupied_today: parseInt(spaces.rows[0].spaces_occupied_today),
      revenue_mtd: parseFloat(revenue.rows[0].revenue_mtd),
      visitors_today: parseInt(visitors.rows[0].visitors_today),
      hot_desks_available: parseInt(hotDesks.rows[0].hot_desks_available),
    });
  } finally {
    client.release();
  }
}

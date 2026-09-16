import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS wv_venue (
  id SERIAL PRIMARY KEY, venue_name TEXT NOT NULL, venue_type TEXT
    CHECK (venue_type IN ('ballroom','garden','chapel','barn','rooftop','hall','outdoor','indoor_outdoor')),
  capacity_min INTEGER, capacity_max INTEGER,
  base_price DECIMAL(10,2) NOT NULL, price_type TEXT DEFAULT 'per_day'
    CHECK (price_type IN ('per_day','per_person','package')),
  amenities TEXT[], photos TEXT[], description TEXT,
  is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wv_booking (
  id SERIAL PRIMARY KEY, venue_id INTEGER REFERENCES wv_venue(id),
  couple_name1 TEXT NOT NULL, couple_name2 TEXT,
  contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL,
  event_date DATE NOT NULL, ceremony_time TIME, reception_time TIME,
  guest_count INTEGER NOT NULL,
  event_type TEXT DEFAULT 'wedding' CHECK (event_type IN ('wedding','engagement_party','bridal_shower','reception_only','anniversary','birthday','corporate','other')),
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry','site_visit','proposal_sent','contract_signed','planning','confirmed','completed','cancelled')),
  total_package_price DECIMAL(12,2), deposit_amount DECIMAL(12,2), deposit_paid BOOLEAN DEFAULT false,
  balance_due DECIMAL(12,2), balance_paid BOOLEAN DEFAULT false,
  ceremony_included BOOLEAN DEFAULT true, catering_included BOOLEAN DEFAULT false,
  catering_provider TEXT, florist TEXT, photographer TEXT,
  wedding_coordinator TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wv_vendor_preferred (
  id SERIAL PRIMARY KEY, vendor_type TEXT NOT NULL
    CHECK (vendor_type IN ('catering','photography','videography','florist','dj','band','hair_makeup','officiant','transportation','cake','decor','other')),
  vendor_name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT, website TEXT,
  commission_pct DECIMAL(5,2) DEFAULT 0, notes TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wv_planning_task (
  id SERIAL PRIMARY KEY, booking_id INTEGER REFERENCES wv_booking(id) ON DELETE CASCADE,
  task_category TEXT, task_name TEXT NOT NULL, due_date DATE,
  assigned_to TEXT, status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','overdue')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(INIT_SQL);

    const year = new Date().getFullYear();

    const [bookingsYear, inquiriesPending, revenueConfirmed, upcomingEvents, venuesCount] = await Promise.all([
      client.query(`SELECT COUNT(*) AS cnt FROM wv_booking WHERE EXTRACT(YEAR FROM event_date)=$1 AND status!='cancelled'`, [year]),
      client.query(`SELECT COUNT(*) AS cnt FROM wv_booking WHERE status IN ('inquiry','site_visit','proposal_sent')`),
      client.query(`SELECT COALESCE(SUM(total_package_price),0) AS total FROM wv_booking WHERE status IN ('contract_signed','planning','confirmed','completed') AND EXTRACT(YEAR FROM event_date)=$1`, [year]),
      client.query(`SELECT id,couple_name1,couple_name2,event_date,venue_id,guest_count,event_type,status FROM wv_booking WHERE event_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30 AND status NOT IN ('cancelled') ORDER BY event_date LIMIT 10`),
      client.query(`SELECT COUNT(*) AS cnt FROM wv_venue WHERE is_active=true`),
    ]);

    return Response.json({
      bookings_this_year: Number(bookingsYear.rows[0].cnt),
      inquiries_pending: Number(inquiriesPending.rows[0].cnt),
      revenue_confirmed: Number(revenueConfirmed.rows[0].total),
      upcoming_events_30d: upcomingEvents.rows,
      venues_count: Number(venuesCount.rows[0].cnt),
    });
  } finally {
    client.release();
  }
}

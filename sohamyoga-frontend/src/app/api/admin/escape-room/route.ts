import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS er_room (
  id SERIAL PRIMARY KEY, room_name TEXT NOT NULL, theme TEXT,
  description TEXT, difficulty TEXT DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard','extreme')),
  min_players INTEGER DEFAULT 2, max_players INTEGER DEFAULT 8,
  duration_minutes INTEGER DEFAULT 60,
  price_per_person DECIMAL(10,2) NOT NULL,
  min_booking_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true, success_rate_pct DECIMAL(5,2),
  total_plays INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS er_booking (
  id SERIAL PRIMARY KEY, room_id INTEGER REFERENCES er_room(id),
  customer_name TEXT NOT NULL, customer_email TEXT, customer_phone TEXT NOT NULL,
  booking_date DATE NOT NULL, start_time TIME NOT NULL,
  player_count INTEGER NOT NULL, total_amount DECIMAL(10,2) NOT NULL,
  deposit_paid DECIMAL(10,2) DEFAULT 0, balance_due DECIMAL(10,2),
  promo_code TEXT, discount_pct DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'booked' CHECK (status IN ('booked','confirmed','checked_in','playing','completed','cancelled','no_show')),
  group_type TEXT CHECK (group_type IN ('friends','corporate','birthday','date_night','family','team_building','other')),
  notes TEXT, waiver_signed BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS er_game_result (
  id SERIAL PRIMARY KEY, booking_id INTEGER REFERENCES er_booking(id),
  room_id INTEGER REFERENCES er_room(id),
  escaped BOOLEAN NOT NULL, time_taken_minutes INTEGER,
  hints_used INTEGER DEFAULT 0, final_clue_reached BOOLEAN DEFAULT false,
  player_count INTEGER, game_master TEXT, notes TEXT,
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  customer_feedback TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS er_promo (
  id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage','fixed_amount')),
  discount_value DECIMAL(10,2), valid_from DATE, valid_until DATE,
  max_uses INTEGER, current_uses INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(INIT_SQL);

    const today = new Date().toISOString().split('T')[0];

    const [bookingsToday, playersToday, escapeRateToday, revenueToday, roomsActive] = await Promise.all([
      client.query(`SELECT COUNT(*) AS cnt FROM er_booking WHERE booking_date=$1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT COALESCE(SUM(player_count),0) AS total FROM er_booking WHERE booking_date=$1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT ROUND(AVG(CASE WHEN escaped THEN 100.0 ELSE 0 END),1) AS rate FROM er_game_result WHERE DATE(created_at)=$1`, [today]),
      client.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM er_booking WHERE booking_date=$1 AND status NOT IN ('cancelled','no_show')`, [today]),
      client.query(`SELECT COUNT(*) AS cnt FROM er_room WHERE is_active=true`),
    ]);

    return Response.json({
      bookings_today: Number(bookingsToday.rows[0].cnt),
      players_today: Number(playersToday.rows[0].total),
      escape_rate_today: Number(escapeRateToday.rows[0].rate)||0,
      revenue_today: Number(revenueToday.rows[0].total),
      rooms_active: Number(roomsActive.rows[0].cnt),
    });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gym_member (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, phone TEXT, date_of_birth DATE,
        membership_type TEXT DEFAULT 'monthly' CHECK (membership_type IN ('day_pass','monthly','quarterly','annual','student','senior','family','corporate')),
        membership_status TEXT DEFAULT 'active' CHECK (membership_status IN ('active','frozen','expired','cancelled')),
        start_date DATE NOT NULL DEFAULT CURRENT_DATE, expiry_date DATE,
        emergency_contact_name TEXT, emergency_contact_phone TEXT,
        health_waiver_signed BOOLEAN DEFAULT false, health_waiver_date TIMESTAMPTZ,
        photo_url TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gym_class (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        instructor TEXT NOT NULL, class_type TEXT DEFAULT 'group'
          CHECK (class_type IN ('group','personal_training','virtual','specialty')),
        capacity INTEGER DEFAULT 20, duration_minutes INTEGER DEFAULT 60,
        schedule_days TEXT[], schedule_time TIME, location TEXT DEFAULT 'Studio A',
        is_active BOOLEAN DEFAULT true, price_drop_in DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gym_booking (
        id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES gym_member(id),
        class_id INTEGER REFERENCES gym_class(id),
        booking_date DATE NOT NULL, status TEXT DEFAULT 'booked'
          CHECK (status IN ('booked','attended','no_show','cancelled','waitlist')),
        booked_at TIMESTAMPTZ DEFAULT NOW(), cancelled_at TIMESTAMPTZ,
        payment_status TEXT DEFAULT 'included' CHECK (payment_status IN ('included','drop_in_paid','unpaid'))
      );
      CREATE TABLE IF NOT EXISTS gym_checkin (
        id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES gym_member(id),
        checked_in_at TIMESTAMPTZ DEFAULT NOW(), checked_out_at TIMESTAMPTZ,
        check_in_method TEXT DEFAULT 'staff' CHECK (check_in_method IN ('staff','kiosk','app','qr'))
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [totalRes, activeRes, classesTodayRes, checkinsRes, revenueRes, expiringRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS total FROM gym_member`),
        client.query(`SELECT COUNT(*) AS active FROM gym_member WHERE membership_status='active'`),
        client.query(`SELECT COUNT(*) AS cnt FROM gym_class WHERE is_active=true`),
        client.query(`SELECT COUNT(*) AS cnt FROM gym_checkin WHERE checked_in_at::date = CURRENT_DATE`),
        client.query(`SELECT COALESCE(SUM(price_drop_in),0) AS mtd FROM gym_class gc JOIN gym_booking gb ON gb.class_id=gc.id WHERE gb.payment_status='drop_in_paid' AND DATE_TRUNC('month',gb.booked_at)=DATE_TRUNC('month',NOW())`),
        client.query(`SELECT id, first_name, last_name, email, membership_type, expiry_date FROM gym_member WHERE membership_status='active' AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30 ORDER BY expiry_date LIMIT 20`),
      ]);
      return Response.json({
        total_members: Number(totalRes.rows[0].total),
        active_members: Number(activeRes.rows[0].active),
        classes_today: Number(classesTodayRes.rows[0].cnt),
        checkins_today: Number(checkinsRes.rows[0].cnt),
        revenue_mtd: Number(revenueRes.rows[0].mtd),
        expiring_soon_30d: expiringRes.rows,
      });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

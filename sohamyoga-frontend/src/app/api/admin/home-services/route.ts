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
      CREATE TABLE IF NOT EXISTS hs_customer (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT NOT NULL,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', postal_code TEXT,
        service_notes TEXT, gate_code TEXT, pet_info TEXT, alarm_code TEXT,
        preferred_team TEXT, referral_source TEXT,
        total_jobs INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hs_job (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES hs_customer(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('regular_cleaning','deep_clean','move_in','move_out','post_construction','carpet_cleaning','window_cleaning','organizing','snow_removal','lawn_care','pressure_washing','other')),
        scheduled_at TIMESTAMPTZ NOT NULL, duration_hours DECIMAL(4,2) DEFAULT 3,
        assigned_team TEXT[], status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','confirmed','en_route','in_progress','completed','cancelled','rescheduled')),
        recurrence TEXT DEFAULT 'one_time' CHECK (recurrence IN ('one_time','weekly','bi_weekly','monthly')),
        price DECIMAL(10,2) NOT NULL, tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT, payment_status TEXT DEFAULT 'pending'
          CHECK (payment_status IN ('pending','paid','partial','overdue')),
        customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
        customer_feedback TEXT, checklist_completed BOOLEAN DEFAULT false,
        before_photo_url TEXT, after_photo_url TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hs_team_member (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        phone TEXT, role TEXT DEFAULT 'cleaner' CHECK (role IN ('cleaner','lead_cleaner','supervisor','driver')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated')),
        hourly_rate DECIMAL(10,2), vehicle TEXT, background_check_date DATE,
        certifications TEXT[], created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hs_supply (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT
          CHECK (category IN ('cleaning_solution','equipment','ppe','disposables','other')),
        quantity_on_hand DECIMAL(10,2), unit TEXT DEFAULT 'unit',
        reorder_point DECIMAL(10,2) DEFAULT 5, cost_per_unit DECIMAL(10,2),
        supplier TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [jobsToday, jobsWeek, revMtd, avgRating, overdue] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM hs_job WHERE scheduled_at::date = $1 AND status NOT IN ('cancelled')`, [today]),
      client.query(`SELECT COUNT(*) FROM hs_job WHERE scheduled_at::date BETWEEN $1 AND $2 AND status NOT IN ('cancelled')`, [today, weekEnd]),
      client.query(`SELECT COALESCE(SUM(price + tip_amount),0) AS total FROM hs_job WHERE scheduled_at >= $1 AND status = 'completed'`, [monthStart]),
      client.query(`SELECT ROUND(AVG(customer_rating)::numeric, 1) AS avg FROM hs_job WHERE customer_rating IS NOT NULL`),
      client.query(`SELECT COUNT(*) FROM hs_job WHERE payment_status = 'overdue'`),
    ]);
    return Response.json({
      jobs_today: parseInt(jobsToday.rows[0].count),
      jobs_this_week: parseInt(jobsWeek.rows[0].count),
      revenue_mtd: parseFloat(revMtd.rows[0].total),
      avg_rating: avgRating.rows[0].avg ?? null,
      overdue_payments_count: parseInt(overdue.rows[0].count),
    });
  } finally { client.release(); }
}

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
      CREATE TABLE IF NOT EXISTS ep_event (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, event_type TEXT NOT NULL
          CHECK (event_type IN ('corporate','wedding','birthday','conference','concert','fundraiser','networking','product_launch','other')),
        client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT,
        event_date DATE NOT NULL, event_time TIME, venue TEXT, venue_address TEXT,
        guest_count INTEGER DEFAULT 0, budget DECIMAL(12,2),
        status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry','planning','confirmed','in_progress','completed','cancelled')),
        theme TEXT, catering TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ep_vendor (
        id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES ep_event(id) ON DELETE CASCADE,
        vendor_type TEXT NOT NULL CHECK (vendor_type IN ('venue','catering','photography','videography','florist','entertainment','decor','audio_visual','transportation','other')),
        vendor_name TEXT NOT NULL, contact_name TEXT, contact_phone TEXT, contact_email TEXT,
        quoted_amount DECIMAL(10,2), confirmed_amount DECIMAL(10,2),
        deposit_paid DECIMAL(10,2) DEFAULT 0, balance_due DECIMAL(10,2),
        contract_signed BOOLEAN DEFAULT false, status TEXT DEFAULT 'contacted'
          CHECK (status IN ('contacted','quoted','booked','confirmed','completed','cancelled')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ep_task (
        id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES ep_event(id) ON DELETE CASCADE,
        task_name TEXT NOT NULL, category TEXT,
        assigned_to TEXT, due_date DATE, status TEXT DEFAULT 'pending'
          CHECK (status IN ('pending','in_progress','completed','overdue')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ep_timeline (
        id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES ep_event(id) ON DELETE CASCADE,
        time_slot TIME NOT NULL, activity TEXT NOT NULL, responsible_party TEXT,
        duration_minutes INTEGER DEFAULT 30, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
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
      const [thisMonthRes, upcomingRes, budgetRes, overdueRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS cnt FROM ep_event WHERE DATE_TRUNC('month', event_date)=DATE_TRUNC('month', NOW()) AND status NOT IN ('cancelled')`),
        client.query(`SELECT id, name, event_type, client_name, event_date, guest_count, status, budget FROM ep_event WHERE event_date >= CURRENT_DATE AND status NOT IN ('cancelled','completed') ORDER BY event_date LIMIT 10`),
        client.query(`SELECT COALESCE(SUM(budget),0) AS pipeline FROM ep_event WHERE status NOT IN ('cancelled','completed')`),
        client.query(`SELECT COUNT(*) AS cnt FROM ep_task WHERE status='overdue' OR (due_date < CURRENT_DATE AND status NOT IN ('completed'))`),
      ]);
      return Response.json({
        events_this_month: Number(thisMonthRes.rows[0].cnt),
        upcoming_events: upcomingRes.rows,
        total_budget_pipeline: Number(budgetRes.rows[0].pipeline),
        overdue_tasks_count: Number(overdueRes.rows[0].cnt),
      });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

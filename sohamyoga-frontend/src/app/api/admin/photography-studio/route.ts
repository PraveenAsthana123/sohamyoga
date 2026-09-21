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
      CREATE TABLE IF NOT EXISTS photo_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, company TEXT,
        client_type TEXT DEFAULT 'individual'
          CHECK (client_type IN ('individual','corporate','wedding','real_estate','commercial','editorial','other')),
        referral_source TEXT, notes TEXT, total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS photo_shoot (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES photo_client(id),
        shoot_type TEXT NOT NULL CHECK (shoot_type IN ('portrait','wedding','corporate','real_estate','product','event','maternity','newborn','family','headshot','boudoir','other')),
        title TEXT NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL,
        location TEXT, duration_hours DECIMAL(4,2) DEFAULT 2,
        photographer TEXT, second_shooter TEXT,
        status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry','booked','deposit_paid','completed','editing','delivered','archived')),
        package_name TEXT, package_price DECIMAL(10,2),
        deposit_amount DECIMAL(10,2), deposit_paid BOOLEAN DEFAULT false,
        balance_due DECIMAL(10,2), balance_paid BOOLEAN DEFAULT false,
        num_edited_photos INTEGER, delivery_method TEXT DEFAULT 'online_gallery',
        gallery_url TEXT, notes TEXT, contract_signed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS photo_package (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, shoot_type TEXT,
        description TEXT, price DECIMAL(10,2) NOT NULL,
        duration_hours DECIMAL(4,2), includes_edited_photos INTEGER,
        includes_prints BOOLEAN DEFAULT false, travel_included_km INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS photo_expense (
        id SERIAL PRIMARY KEY, shoot_id INTEGER REFERENCES photo_shoot(id),
        category TEXT CHECK (category IN ('equipment','travel','props','second_shooter','venue_fee','printing','software','other')),
        description TEXT NOT NULL, amount DECIMAL(10,2) NOT NULL,
        receipt_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString();
    const [shootsMtd, revMtd, pendingDel, upcoming] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM photo_shoot WHERE scheduled_at >= $1`, [monthStart]),
      client.query(`SELECT COALESCE(SUM(package_price),0) AS total FROM photo_shoot WHERE scheduled_at >= $1 AND status NOT IN ('inquiry','archived')`, [monthStart]),
      client.query(`SELECT COUNT(*) FROM photo_shoot WHERE status IN ('completed','editing')`),
      client.query(`SELECT COUNT(*) FROM photo_shoot WHERE scheduled_at BETWEEN NOW() AND $1 AND status IN ('booked','deposit_paid')`, [nextWeek]),
    ]);
    return Response.json({
      shoots_this_month: parseInt(shootsMtd.rows[0].count),
      revenue_mtd: parseFloat(revMtd.rows[0].total),
      pending_deliveries: parseInt(pendingDel.rows[0].count),
      upcoming_shoots_7d: parseInt(upcoming.rows[0].count),
    });
  } finally { client.release(); }
}

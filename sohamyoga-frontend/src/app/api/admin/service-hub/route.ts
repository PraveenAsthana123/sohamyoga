export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS service_packages (
    id SERIAL PRIMARY KEY, name TEXT, type TEXT DEFAULT 'service', price NUMERIC DEFAULT 0,
    description TEXT, duration_minutes INTEGER DEFAULT 60, max_participants INTEGER DEFAULT 1,
    is_gift BOOLEAN DEFAULT FALSE, status TEXT DEFAULT 'active', sold_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS service_upsell_rules (
    id SERIAL PRIMARY KEY, trigger_service TEXT, upsell_offer TEXT, discount_pct INTEGER DEFAULT 0,
    timing TEXT DEFAULT 'at_checkout', accepted_count INTEGER DEFAULT 0, shown_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS demand_forecasts (
    id SERIAL PRIMARY KEY, service_name TEXT, period TEXT, actual_bookings INTEGER DEFAULT 0,
    forecasted_bookings INTEGER DEFAULT 0, confidence_pct INTEGER DEFAULT 70, factors TEXT[], created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS staff_utilization (
    id SERIAL PRIMARY KEY, staff_name TEXT, role TEXT, period TEXT, scheduled_hours NUMERIC DEFAULT 0,
    actual_hours NUMERIC DEFAULT 0, utilization_pct NUMERIC DEFAULT 0, services_delivered INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY, booking_reference TEXT, customer_name TEXT, service TEXT,
    total_amount NUMERIC DEFAULT 0, deposit_amount NUMERIC DEFAULT 0, status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ, due_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM service_packages');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO service_packages (name, type, price, description, duration_minutes, max_participants, is_gift, sold_count) VALUES
      ('Beginner Yoga Series','class',149.00,'8-week beginner yoga program. 2x per week, all levels welcome.',60,15,false,127),
      ('Private 1-on-1 Session','session',95.00,'Personal yoga session with certified instructor. Tailored to your goals.',60,1,false,43),
      ('Corporate Wellness Package','bundle',1200.00,'Monthly corporate yoga program. Up to 20 employees, bi-weekly sessions.',60,20,false,8),
      ('Wellness Gift Card $50','gift',50.00,'Digital gift card for any yoga class or session. Never expires.',0,0,true,89),
      ('Annual Unlimited Membership','membership',799.00,'Unlimited classes for 12 months. Access to all instructors and workshops.',0,1,false,34),
      ('Weekend Yoga Retreat','retreat',299.00,'2-day yoga and wellness retreat. Includes meals and accommodation.',480,20,false,12)
    `);
    await client.query(`INSERT INTO service_upsell_rules (trigger_service, upsell_offer, discount_pct, timing, accepted_count, shown_count) VALUES
      ('Beginner Yoga Series','Add 1-on-1 session for personalized feedback',20,'post_purchase',23,67),
      ('Private 1-on-1 Session','Upgrade to Monthly Package — save 15%',15,'at_checkout',31,89),
      ('Corporate Wellness Package','Add Employee Wellness Assessment',10,'at_checkout',4,12),
      ('Wellness Gift Card $50','Upgrade to $100 gift card + free wellness guide',0,'at_cart',41,156)
    `);
    await client.query(`INSERT INTO demand_forecasts (service_name, period, actual_bookings, forecasted_bookings, confidence_pct, factors) VALUES
      ('Beginner Yoga Series','2026-W37',24,22,82,ARRAY['seasonal','new year surge', 'back-to-school']),
      ('Private 1-on-1 Session','2026-W37',11,13,76,ARRAY['word-of-mouth growth','holiday season']),
      ('Corporate Wellness Package','2026-W37',2,3,68,ARRAY['Q4 budget cycles','HR initiatives']),
      ('Beginner Yoga Series','2026-W38',0,26,79,ARRAY['upcoming promo campaign','historical trend'])
    `);
    await client.query(`INSERT INTO staff_utilization (staff_name, role, period, scheduled_hours, actual_hours, utilization_pct, services_delivered) VALUES
      ('Instructor Sarah K','Senior Instructor','2026-W36',40,38,95,19),
      ('Instructor Mike R','Junior Instructor','2026-W36',32,28,87.5,14),
      ('Instructor Priya S','Senior Instructor','2026-W36',40,42,105,21),
      ('Admin Lisa P','Studio Manager','2026-W36',40,39,97.5,0),
      ('Instructor James L','Part-time Instructor','2026-W36',20,18,90,9)
    `);
    await client.query(`INSERT INTO deposits (booking_reference, customer_name, service, total_amount, deposit_amount, status, due_date) VALUES
      ('BK-2026-001','Sarah Johnson','Weekend Yoga Retreat',299.00,100.00,'paid','2026-09-01'),
      ('BK-2026-002','TechCorp Inc','Corporate Wellness Package',1200.00,400.00,'pending','2026-09-25'),
      ('BK-2026-003','Michael Chen','Annual Unlimited Membership',799.00,200.00,'paid','2026-09-10'),
      ('BK-2026-004','Green HR Solutions','Corporate Wellness Package',1200.00,400.00,'pending','2026-09-28'),
      ('BK-2026-005','Emily Rodriguez','Weekend Yoga Retreat',299.00,100.00,'overdue','2026-09-05')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const [packages, stats] = await Promise.all([
      client.query('SELECT * FROM service_packages ORDER BY sold_count DESC'),
      client.query(`SELECT COALESCE(SUM(price * sold_count),0) as total_revenue,
        COALESCE(SUM(sold_count),0) as total_sold,
        COALESCE(SUM(CASE WHEN is_gift THEN price * sold_count ELSE 0 END),0) as gift_revenue,
        COALESCE(SUM(CASE WHEN type='membership' THEN price * sold_count ELSE 0 END),0) as mrr
        FROM service_packages WHERE status='active'`),
    ]);
    return Response.json({ packages: packages.rows, stats: stats.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `INSERT INTO service_packages (name, type, price, description, duration_minutes, max_participants, is_gift)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.name, body.type || 'service', body.price || 0, body.description, body.duration_minutes || 60, body.max_participants || 1, body.is_gift || false]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

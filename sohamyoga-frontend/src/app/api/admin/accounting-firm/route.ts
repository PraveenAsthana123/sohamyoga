import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounting_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        client_type TEXT DEFAULT 'corporate',
        email TEXT, phone TEXT, address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        bn TEXT,
        fiscal_year_end DATE, industry TEXT,
        annual_revenue NUMERIC(12,2), num_employees INT,
        services TEXT[],
        software TEXT,
        engagement_type TEXT DEFAULT 'annual',
        monthly_fee NUMERIC(8,2), hourly_rate NUMERIC(8,2),
        status TEXT DEFAULT 'active', assigned_cpa TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_engagement (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES accounting_client(id) ON DELETE CASCADE,
        engagement_type TEXT NOT NULL,
        period_start DATE, period_end DATE,
        status TEXT DEFAULT 'not_started',
        assigned_to TEXT, due_date DATE, completed_date DATE,
        hours_budget NUMERIC(6,2), hours_actual NUMERIC(6,2) DEFAULT 0,
        fee NUMERIC(10,2), invoiced BOOLEAN DEFAULT false, paid BOOLEAN DEFAULT false,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_time_entry (
        id SERIAL PRIMARY KEY, engagement_id INT REFERENCES accounting_engagement(id),
        client_id INT REFERENCES accounting_client(id),
        date DATE DEFAULT CURRENT_DATE, staff_name TEXT, service_code TEXT,
        description TEXT NOT NULL, hours NUMERIC(6,2) NOT NULL, rate NUMERIC(8,2),
        billable BOOLEAN DEFAULT true, billed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data if empty
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM accounting_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO accounting_client (name, client_type, email, phone, city, province, bn, industry, annual_revenue, num_employees, services, software, engagement_type, monthly_fee, hourly_rate, status, assigned_cpa)
        VALUES
          ('Prairie Grains Ltd.', 'corporate', 'cfo@prairiegrains.ca', '403-555-0101', 'Calgary', 'AB', '123456789RT0001', 'Agriculture', 8500000, 42, ARRAY['bookkeeping','payroll','t2','gst'], 'QuickBooks', 'monthly_bookkeeping', 1800, 185, 'active', 'Sarah Chen CPA'),
          ('Nguyen Family Trust', 'trust', 'david.nguyen@email.ca', '403-555-0202', 'Calgary', 'AB', NULL, 'Real Estate', 420000, NULL, ARRAY['t1','advisory','estate'], 'Excel', 'annual', NULL, 220, 'active', 'James Reimer CPA'),
          ('Redstone Plumbing Inc.', 'corporate', 'ops@redstone.ca', '403-555-0303', 'Red Deer', 'AB', '987654321RT0001', 'Construction', 2100000, 18, ARRAY['bookkeeping','payroll','t2','gst'], 'Sage50', 'monthly_bookkeeping', 950, 175, 'active', 'Sarah Chen CPA'),
          ('Calgary Community Theatre', 'non_profit', 'admin@cct.ca', '403-555-0404', 'Calgary', 'AB', '555444333RT0001', 'Arts & Culture', 380000, 6, ARRAY['bookkeeping','t2','audit'], 'Wave', 'annual', NULL, 165, 'active', 'James Reimer CPA'),
          ('Horizon Tech Partners', 'partnership', 'partners@horizontech.ca', '403-555-0505', 'Calgary', 'AB', '111222333RT0001', 'Technology', 1750000, 12, ARRAY['bookkeeping','payroll','t2','gst','advisory'], 'Xero', 'quarterly', 2200, 195, 'active', 'Sarah Chen CPA')
      `);
      await client.query(`
        INSERT INTO accounting_engagement (client_id, engagement_type, period_start, period_end, status, assigned_to, due_date, hours_budget, hours_actual, fee, invoiced)
        VALUES
          (1, 'bookkeeping', '2026-09-01', '2026-09-30', 'in_progress', 'Sarah Chen CPA', '2026-10-10', 8, 5.5, 1800, false),
          (1, 'payroll', '2026-09-01', '2026-09-30', 'in_progress', 'Sarah Chen CPA', '2026-09-25', 3, 2, 350, false),
          (2, 't1', '2025-01-01', '2025-12-31', 'review', 'James Reimer CPA', '2026-04-30', 12, 10, 1650, false),
          (3, 'bookkeeping', '2026-09-01', '2026-09-30', 'not_started', 'Sarah Chen CPA', '2026-10-10', 6, 0, 950, false),
          (4, 'audit', '2025-04-01', '2026-03-31', 'completed', 'James Reimer CPA', '2026-09-15', 40, 38, 6200, true),
          (5, 'advisory', '2026-01-01', '2026-12-31', 'in_progress', 'Sarah Chen CPA', '2026-12-15', 20, 8, 4400, false)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const mode = searchParams.get('mode');

      if (mode === 'dashboard') {
        const [mrr, clientTypes, engagementsDue, overdue, wip] = await Promise.all([
          client.query(`SELECT COALESCE(SUM(monthly_fee),0) AS mrr FROM accounting_client WHERE status='active' AND monthly_fee IS NOT NULL`),
          client.query(`SELECT client_type, COUNT(*) AS cnt FROM accounting_client GROUP BY client_type ORDER BY cnt DESC`),
          client.query(`SELECT COUNT(*) AS cnt FROM accounting_engagement WHERE status NOT IN ('completed','filed','billed') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30`),
          client.query(`SELECT COUNT(*) AS cnt FROM accounting_engagement WHERE status NOT IN ('completed','filed','billed') AND due_date < CURRENT_DATE`),
          client.query(`SELECT COALESCE(SUM(t.hours * t.rate),0) AS wip_value FROM accounting_time_entry t WHERE t.billable=true AND t.billed=false`),
        ]);
        return Response.json({
          mrr: Number(mrr.rows[0].mrr),
          clientTypes: clientTypes.rows,
          engagementsDue: Number(engagementsDue.rows[0].cnt),
          overdue: Number(overdue.rows[0].cnt),
          wipValue: Number(wip.rows[0].wip_value),
        });
      }

      // List clients
      const type = searchParams.get('type');
      const software = searchParams.get('software');
      const assigned = searchParams.get('assigned_cpa');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (type) { conditions.push(`client_type=$${vals.length + 1}`); vals.push(type); }
      if (software) { conditions.push(`software=$${vals.length + 1}`); vals.push(software); }
      if (assigned) { conditions.push(`assigned_cpa=$${vals.length + 1}`); vals.push(assigned); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM accounting_client ${where} ORDER BY name`, vals);
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('accounting-firm GET error:', err);
    return Response.json({ error: 'Failed to fetch data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTables();
    const body = await req.json().catch(() => null);
    if (!body?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO accounting_client (name, client_type, email, phone, address, city, province, bn, fiscal_year_end, industry, annual_revenue, num_employees, services, software, engagement_type, monthly_fee, hourly_rate, status, assigned_cpa, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [body.name, body.client_type ?? 'corporate', body.email, body.phone, body.address, body.city ?? 'Calgary', body.province ?? 'AB', body.bn, body.fiscal_year_end, body.industry, body.annual_revenue, body.num_employees, body.services, body.software, body.engagement_type ?? 'annual', body.monthly_fee, body.hourly_rate, body.status ?? 'active', body.assigned_cpa, body.notes]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('accounting-firm POST error:', err);
    return Response.json({ error: 'Failed to create client.' }, { status: 500 });
  }
}

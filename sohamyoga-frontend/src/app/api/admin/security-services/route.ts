import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sec_client (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        contract_type TEXT DEFAULT 'monthly' CHECK (contract_type IN ('monthly','annual','per_event','retainer')),
        service_types TEXT[] DEFAULT ARRAY['static_guard'],
        monthly_value DECIMAL(10,2), contract_start DATE, contract_end DATE,
        site_count INTEGER DEFAULT 1, special_instructions TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','expired','cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sec_guard (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL,
        license_number TEXT UNIQUE, license_type TEXT DEFAULT 'basic'
          CHECK (license_type IN ('basic','armed','supervisor','investigator')),
        license_expiry DATE, security_clearance TEXT,
        first_aid_certified BOOLEAN DEFAULT false, first_aid_expiry DATE,
        certifications TEXT[], languages TEXT[] DEFAULT ARRAY['English'],
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated')),
        hourly_rate DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sec_shift (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES sec_client(id),
        guard_id INTEGER REFERENCES sec_guard(id),
        site_name TEXT NOT NULL, site_address TEXT,
        shift_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
        shift_type TEXT DEFAULT 'static' CHECK (shift_type IN ('static','mobile_patrol','event','emergency','escort','investigation')),
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','missed','cancelled')),
        check_in_time TIME, check_out_time TIME, break_minutes INTEGER DEFAULT 30,
        hours_worked DECIMAL(5,2), bill_rate DECIMAL(10,2), pay_rate DECIMAL(10,2),
        incident_reported BOOLEAN DEFAULT false, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sec_incident (
        id SERIAL PRIMARY KEY, shift_id INTEGER REFERENCES sec_shift(id),
        client_id INTEGER REFERENCES sec_client(id),
        guard_id INTEGER REFERENCES sec_guard(id),
        incident_type TEXT NOT NULL CHECK (incident_type IN ('theft','vandalism','trespass','medical','fire','suspicious_activity','altercation','property_damage','other')),
        severity TEXT DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
        incident_time TIMESTAMPTZ NOT NULL, location TEXT,
        description TEXT NOT NULL, action_taken TEXT, police_called BOOLEAN DEFAULT false,
        police_report_number TEXT, witnesses TEXT, follow_up_required BOOLEAN DEFAULT false,
        follow_up_notes TEXT, report_submitted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const [shifts, guardsActive, clientsCount, incidents, missed, expiring] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM sec_shift WHERE shift_date = $1`, [today]),
      client.query(`SELECT COUNT(DISTINCT guard_id) AS n FROM sec_shift WHERE shift_date = $1 AND status IN ('confirmed','in_progress')`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM sec_client WHERE status = 'active'`),
      client.query(`SELECT COUNT(*) AS n FROM sec_incident WHERE date_trunc('month', incident_time) = date_trunc('month', NOW())`),
      client.query(`SELECT COUNT(*) AS n FROM sec_shift WHERE date_trunc('month', shift_date) = date_trunc('month', NOW()) AND status = 'missed'`),
      client.query(`SELECT COUNT(*) AS n FROM sec_guard WHERE license_expiry BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND status = 'active'`),
    ]);
    const todayShifts = await client.query(`
      SELECT s.*, g.first_name || ' ' || g.last_name AS guard_name, c.company_name
      FROM sec_shift s
      LEFT JOIN sec_guard g ON g.id = s.guard_id
      LEFT JOIN sec_client c ON c.id = s.client_id
      WHERE s.shift_date = $1
      ORDER BY s.start_time
    `, [today]);
    return NextResponse.json({
      shifts_today: parseInt(shifts.rows[0].n),
      guards_active_today: parseInt(guardsActive.rows[0].n),
      clients_count: parseInt(clientsCount.rows[0].n),
      incidents_mtd: parseInt(incidents.rows[0].n),
      missed_shifts_mtd: parseInt(missed.rows[0].n),
      expiring_licenses_30d: parseInt(expiring.rows[0].n),
      today_shifts: todayShifts.rows,
    });
  } finally {
    client.release();
  }
}

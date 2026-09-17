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
      CREATE TABLE IF NOT EXISTS rs_clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        genre TEXT,
        label_affiliation TEXT,
        socan_membership_number TEXT,
        factor_eligible BOOLEAN DEFAULT false,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rs_projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES rs_clients(id) ON DELETE SET NULL,
        project_name TEXT NOT NULL,
        project_type TEXT,
        genre TEXT,
        status TEXT DEFAULT 'pre_production',
        estimated_hours NUMERIC,
        actual_hours NUMERIC DEFAULT 0,
        hourly_rate NUMERIC,
        contract_value NUMERIC,
        billed_to_date NUMERIC DEFAULT 0,
        isrc_prefix TEXT,
        upc_code TEXT,
        release_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rs_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES rs_projects(id) ON DELETE SET NULL,
        studio_room TEXT,
        engineer_name TEXT,
        session_date DATE,
        start_time TIME,
        end_time TIME,
        hours_logged NUMERIC DEFAULT 0,
        session_type TEXT,
        tracks_recorded TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rs_engineers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        specialty TEXT[],
        daw_proficiencies TEXT[],
        day_rate NUMERIC,
        status TEXT DEFAULT 'available',
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rs_equipment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT,
        brand TEXT,
        model TEXT,
        serial_number TEXT,
        insurance_value NUMERIC,
        condition TEXT DEFAULT 'good',
        last_service_date DATE,
        next_service_due DATE,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rs_sync_licenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES rs_projects(id) ON DELETE SET NULL,
        track_name TEXT NOT NULL,
        licensee_name TEXT,
        use_type TEXT,
        territory TEXT,
        license_fee NUMERIC,
        exclusivity BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'negotiating',
        notes TEXT,
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
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const [activeProjects, hoursMonth, sessionsWeek, revenueMtd, maintenance, invoices] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM rs_projects WHERE status NOT IN ('delivered','cancelled')`),
      client.query(`SELECT COALESCE(SUM(hours_logged),0) AS h FROM rs_sessions WHERE session_date >= $1`, [firstOfMonth]),
      client.query(`SELECT COUNT(*) AS n FROM rs_sessions WHERE session_date >= NOW() - INTERVAL '7 days'`),
      client.query(`SELECT COALESCE(SUM(contract_value - billed_to_date),0) AS rev FROM rs_projects WHERE status NOT IN ('delivered','cancelled')`),
      client.query(`SELECT COUNT(*) AS n FROM rs_equipment WHERE next_service_due <= NOW() + INTERVAL '30 days' AND is_active = true`),
      client.query(`SELECT COALESCE(SUM(contract_value - billed_to_date),0) AS total FROM rs_projects WHERE billed_to_date < contract_value AND status NOT IN ('cancelled')`),
    ]);
    return Response.json({
      active_projects: parseInt(activeProjects.rows[0].n, 10),
      studio_hours_this_month: parseFloat(hoursMonth.rows[0].h),
      sessions_this_week: parseInt(sessionsWeek.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueMtd.rows[0].rev),
      equipment_maintenance_due: parseInt(maintenance.rows[0].n, 10),
      outstanding_invoices: parseFloat(invoices.rows[0].total),
    });
  } finally {
    client.release();
  }
}

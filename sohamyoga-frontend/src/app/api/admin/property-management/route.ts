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
      CREATE TABLE IF NOT EXISTS pm_property (
        id SERIAL PRIMARY KEY, address TEXT NOT NULL, city TEXT DEFAULT 'Calgary',
        province TEXT DEFAULT 'AB', postal_code TEXT,
        property_type TEXT DEFAULT 'residential'
          CHECK (property_type IN ('residential','commercial','condo','townhouse','duplex','multi_unit')),
        units_count INTEGER DEFAULT 1, owner_name TEXT, owner_email TEXT, owner_phone TEXT,
        monthly_rent DECIMAL(10,2), purchase_price DECIMAL(12,2),
        year_built INTEGER, square_feet INTEGER,
        status TEXT DEFAULT 'occupied' CHECK (status IN ('occupied','vacant','maintenance','listed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pm_tenant (
        id SERIAL PRIMARY KEY, property_id INTEGER REFERENCES pm_property(id),
        first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, unit_number TEXT,
        lease_start DATE NOT NULL, lease_end DATE,
        monthly_rent DECIMAL(10,2) NOT NULL, security_deposit DECIMAL(10,2),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','notice_given','moved_out','eviction')),
        emergency_contact_name TEXT, emergency_contact_phone TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pm_rent_payment (
        id SERIAL PRIMARY KEY, tenant_id INTEGER REFERENCES pm_tenant(id),
        property_id INTEGER REFERENCES pm_property(id),
        amount DECIMAL(10,2) NOT NULL, due_date DATE NOT NULL,
        paid_date DATE, payment_method TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','late','waived')),
        late_fee DECIMAL(10,2) DEFAULT 0, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pm_maintenance (
        id SERIAL PRIMARY KEY, property_id INTEGER REFERENCES pm_property(id),
        tenant_id INTEGER REFERENCES pm_tenant(id),
        issue_type TEXT NOT NULL CHECK (issue_type IN ('plumbing','electrical','hvac','appliance','structural','pest','cleaning','landscaping','other')),
        description TEXT NOT NULL, priority TEXT DEFAULT 'medium'
          CHECK (priority IN ('emergency','high','medium','low')),
        status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','deferred')),
        assigned_contractor TEXT, estimated_cost DECIMAL(10,2), actual_cost DECIMAL(10,2),
        reported_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM pm_property`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO pm_property (address, city, province, postal_code, property_type, units_count, owner_name, owner_email, owner_phone, monthly_rent, purchase_price, year_built, square_feet, status)
        VALUES
          ('123 Maple St NW', 'Calgary', 'AB', 'T2N 1A1', 'residential', 1, 'Robert Chen', 'robert.chen@email.ca', '403-555-0101', 2200.00, 485000.00, 2005, 1450, 'occupied'),
          ('456 Elm Ave SW', 'Calgary', 'AB', 'T2T 2B2', 'condo', 1, 'Maria Santos', 'maria.santos@email.ca', '403-555-0202', 1800.00, 320000.00, 2015, 890, 'occupied'),
          ('789 Oak Dr SE', 'Calgary', 'AB', 'T2H 3C3', 'duplex', 2, 'James Wilson', 'j.wilson@email.ca', '403-555-0303', 3200.00, 620000.00, 1998, 2100, 'occupied'),
          ('321 Pine Blvd NE', 'Calgary', 'AB', 'T2E 4D4', 'townhouse', 1, 'Linda Park', 'linda.park@email.ca', '403-555-0404', 2400.00, 395000.00, 2010, 1680, 'vacant')
      `);
      await client.query(`
        INSERT INTO pm_tenant (property_id, first_name, last_name, email, phone, lease_start, lease_end, monthly_rent, security_deposit, status)
        VALUES
          (1, 'Ahmed', 'Hassan', 'ahmed.hassan@email.ca', '403-555-1001', '2024-01-01', '2025-01-01', 2200.00, 2200.00, 'active'),
          (2, 'Sarah', 'Nguyen', 'sarah.nguyen@email.ca', '403-555-1002', '2024-03-01', '2025-03-01', 1800.00, 1800.00, 'active'),
          (3, 'David', 'Kowalski', 'david.k@email.ca', '403-555-1003', '2023-09-01', '2024-09-01', 1600.00, 1600.00, 'notice_given')
      `);
      await client.query(`
        INSERT INTO pm_maintenance (property_id, tenant_id, issue_type, description, priority, status)
        VALUES
          (1, 1, 'plumbing', 'Kitchen faucet dripping', 'medium', 'open'),
          (3, 3, 'hvac', 'Furnace not heating properly', 'high', 'in_progress'),
          (2, 2, 'appliance', 'Dishwasher leaking', 'medium', 'open')
      `);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [props, vacants, rentMtd, maintOpen, overdueRent] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM pm_property`),
        client.query(`SELECT COUNT(*) AS n FROM pm_property WHERE status='vacant'`),
        client.query(`SELECT COALESCE(SUM(amount),0) AS total FROM pm_rent_payment WHERE status='paid' AND DATE_TRUNC('month',paid_date)=DATE_TRUNC('month',NOW())`),
        client.query(`SELECT COUNT(*) AS n FROM pm_maintenance WHERE status IN ('open','in_progress')`),
        client.query(`SELECT COUNT(*) AS n FROM pm_rent_payment WHERE status IN ('pending','late') AND due_date < NOW()`),
      ]);
      return Response.json({
        total_properties: parseInt(props.rows[0].n, 10),
        vacant_count: parseInt(vacants.rows[0].n, 10),
        rent_collected_mtd: parseFloat(rentMtd.rows[0].total),
        maintenance_open: parseInt(maintOpen.rows[0].n, 10),
        overdue_rent_count: parseInt(overdueRent.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

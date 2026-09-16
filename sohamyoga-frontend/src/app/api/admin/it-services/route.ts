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
      CREATE TABLE IF NOT EXISTS it_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT,
        email TEXT, phone TEXT, industry TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        num_users INT, num_devices INT,
        primary_os TEXT DEFAULT 'windows',
        cloud_platform TEXT,
        services TEXT[],
        contract_type TEXT DEFAULT 'managed',
        monthly_fee NUMERIC(8,2), contract_start DATE, contract_end DATE,
        sla_response_hours INT DEFAULT 4, sla_resolution_hours INT DEFAULT 24,
        status TEXT DEFAULT 'active',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS it_ticket (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES it_client(id) ON DELETE CASCADE,
        ticket_number TEXT,
        title TEXT NOT NULL, description TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        assigned_to TEXT, reported_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        first_response_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
        sla_breach BOOLEAN DEFAULT false,
        resolution_notes TEXT, time_spent_minutes INT DEFAULT 0,
        billable BOOLEAN DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS it_asset (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES it_client(id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL,
        make TEXT, model TEXT, serial_number TEXT,
        assigned_to_user TEXT, location TEXT,
        purchase_date DATE, warranty_expiry DATE,
        os TEXT, os_version TEXT, last_patch_date DATE,
        status TEXT DEFAULT 'active',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS it_project (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES it_client(id) ON DELETE CASCADE,
        title TEXT NOT NULL, project_type TEXT,
        status TEXT DEFAULT 'scoping',
        start_date DATE, end_date DATE,
        contract_value NUMERIC(10,2), hours_budget NUMERIC(8,2), hours_actual NUMERIC(8,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM it_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO it_client (name, contact_person, email, phone, industry, city, num_users, num_devices, primary_os, cloud_platform, services, contract_type, monthly_fee, contract_start, contract_end, sla_response_hours, sla_resolution_hours, status)
        VALUES
          ('Pinecrest Legal LLP', 'Amanda Kowalski', 'akowalski@pinecrest.ca', '403-555-0601', 'Legal', 'Calgary', 28, 35, 'windows', 'microsoft365', ARRAY['helpdesk','network','m365','backup','security'], 'managed', 3800, '2026-01-01', '2026-12-31', 2, 8, 'active'),
          ('Clearwater Dental Group', 'Dr. Paul Nguyen', 'pnguyen@clearwaterdental.ca', '403-555-0602', 'Healthcare', 'Calgary', 18, 22, 'windows', 'microsoft365', ARRAY['helpdesk','m365','backup','security','server'], 'managed', 2600, '2026-03-01', '2027-02-28', 4, 16, 'active'),
          ('Rocky Mountain Fabricators', 'Steve Olsen', 'solsen@rockymfg.ca', '403-555-0603', 'Manufacturing', 'Lethbridge', 52, 68, 'mixed', 'aws', ARRAY['helpdesk','network','cloud','server','backup','security'], 'managed', 6500, '2025-07-01', '2026-06-30', 4, 24, 'active'),
          ('Summit Accounting Partners', 'Laura Tran', 'ltran@summitaccounting.ca', '403-555-0604', 'Professional Services', 'Calgary', 12, 15, 'windows', 'microsoft365', ARRAY['helpdesk','m365','backup'], 'break_fix', NULL, NULL, NULL, 8, 48, 'active'),
          ('Highpoint Retail Inc.', 'Mike Fillion', 'mfillion@highpointretail.ca', '403-555-0605', 'Retail', 'Calgary', 35, 48, 'windows', 'none', ARRAY['helpdesk','network','server','backup','voip'], 'managed', 4200, '2026-06-01', '2027-05-31', 4, 24, 'active')
      `);
      await client.query(`
        INSERT INTO it_ticket (client_id, ticket_number, title, description, category, priority, status, assigned_to, reported_by, sla_breach, time_spent_minutes)
        VALUES
          (1, 'TKT-2026-0001', 'Outlook not syncing on laptop', 'User cannot receive emails since this morning', 'email', 'high', 'in_progress', 'Dave Parker', 'Amanda K.', false, 45),
          (1, 'TKT-2026-0002', 'Printer offline — boardroom', 'HP LaserJet shows offline in print queue', 'printer', 'medium', 'open', NULL, 'Reception', false, 0),
          (2, 'TKT-2026-0003', 'Patient management software crash', 'Dentrix crashes on startup for front desk', 'software', 'critical', 'assigned', 'Sarah Ling', 'Dr. Nguyen', false, 20),
          (3, 'TKT-2026-0004', 'VPN disconnecting frequently', 'Remote workers losing VPN every 20 minutes', 'network', 'high', 'in_progress', 'Dave Parker', 'Steve O.', true, 120),
          (4, 'TKT-2026-0005', 'QuickBooks license expired', 'Cannot open QuickBooks — license error', 'software', 'high', 'open', NULL, 'Laura T.', false, 0),
          (5, 'TKT-2026-0006', 'POS system update required', 'Retail POS needs firmware update before end of month', 'hardware', 'low', 'open', NULL, 'Mike F.', false, 0)
      `);
      await client.query(`
        INSERT INTO it_asset (client_id, asset_type, make, model, serial_number, assigned_to_user, location, purchase_date, warranty_expiry, os, os_version, last_patch_date, status)
        VALUES
          (1, 'laptop', 'Dell', 'Latitude 5540', 'DL5540-001', 'Amanda Kowalski', 'Office', '2022-03-15', '2025-03-15', 'windows', '11 Pro', '2026-08-01', 'active'),
          (1, 'server', 'HPE', 'ProLiant DL380', 'HPE380-SRV01', NULL, 'Server Room', '2021-06-01', '2024-06-01', 'windows', 'Server 2022', '2026-08-15', 'active'),
          (2, 'desktop', 'HP', 'EliteDesk 800 G6', 'HP800-FD01', 'Front Desk', 'Reception', '2023-01-10', '2026-01-10', 'windows', '11 Pro', '2026-09-01', 'active'),
          (3, 'network_device', 'Cisco', 'Catalyst 9300', 'CSC-9300-CORE', NULL, 'Main Data Room', '2020-09-01', '2023-09-01', NULL, NULL, NULL, 'active'),
          (5, 'tablet', 'Apple', 'iPad 10th Gen', 'APL-IPAD-001', 'POS Terminal 1', 'Store Floor', '2024-02-01', '2026-02-01', 'ipados', '17.6', '2026-09-10', 'active')
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
        const [openTkts, critTkts, slaBreach, mrr, warrantyExp] = await Promise.all([
          client.query(`SELECT COUNT(*) AS cnt FROM it_ticket WHERE status NOT IN ('resolved','closed')`),
          client.query(`SELECT COUNT(*) AS cnt FROM it_ticket WHERE priority='critical' AND status NOT IN ('resolved','closed')`),
          client.query(`SELECT COUNT(*) AS cnt FROM it_ticket WHERE sla_breach=true AND status NOT IN ('resolved','closed')`),
          client.query(`SELECT COALESCE(SUM(monthly_fee),0) AS mrr FROM it_client WHERE status='active' AND contract_type='managed'`),
          client.query(`SELECT COUNT(*) AS cnt FROM it_asset WHERE warranty_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE+90 AND status='active'`),
        ]);
        return Response.json({
          openTickets: Number(openTkts.rows[0].cnt),
          criticalTickets: Number(critTkts.rows[0].cnt),
          slaBreaches: Number(slaBreach.rows[0].cnt),
          mrr: Number(mrr.rows[0].mrr),
          warrantyExpiring: Number(warrantyExp.rows[0].cnt),
        });
      }

      // List clients
      const contractType = searchParams.get('contract_type');
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (contractType) { conditions.push(`contract_type=$${vals.length + 1}`); vals.push(contractType); }
      if (status) { conditions.push(`status=$${vals.length + 1}`); vals.push(status); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT c.*, (SELECT COUNT(*) FROM it_ticket t WHERE t.client_id=c.id AND t.status NOT IN ('resolved','closed')) AS open_tickets FROM it_client c ${where} ORDER BY c.name`,
        vals
      );
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('it-services GET error:', err);
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
        `INSERT INTO it_client (name, contact_person, email, phone, industry, city, province, num_users, num_devices, primary_os, cloud_platform, services, contract_type, monthly_fee, contract_start, contract_end, sla_response_hours, sla_resolution_hours, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [body.name, body.contact_person, body.email, body.phone, body.industry, body.city ?? 'Calgary', body.province ?? 'AB', body.num_users, body.num_devices, body.primary_os ?? 'windows', body.cloud_platform, body.services, body.contract_type ?? 'managed', body.monthly_fee, body.contract_start, body.contract_end, body.sla_response_hours ?? 4, body.sla_resolution_hours ?? 24, body.status ?? 'active', body.notes]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('it-services POST error:', err);
    return Response.json({ error: 'Failed to create client.' }, { status: 500 });
  }
}

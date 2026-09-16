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
      CREATE TABLE IF NOT EXISTS cpm_client (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL,
        billing_address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        client_type TEXT DEFAULT 'commercial'
          CHECK (client_type IN ('residential','commercial','industrial','municipal','institutional')),
        total_projects INTEGER DEFAULT 0, total_contract_value DECIMAL(14,2) DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','prospect','inactive')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cpm_project (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES cpm_client(id),
        project_name TEXT NOT NULL, project_number TEXT UNIQUE NOT NULL,
        project_type TEXT NOT NULL CHECK (project_type IN ('new_build','renovation','addition','tenant_improvement','infrastructure','site_development','industrial','other')),
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', site_address TEXT,
        project_manager TEXT, superintendent TEXT,
        status TEXT DEFAULT 'bidding'
          CHECK (status IN ('bidding','awarded','pre_construction','active','substantial_completion','closeout','completed','on_hold','cancelled')),
        contract_value DECIMAL(14,2), change_orders_total DECIMAL(12,2) DEFAULT 0,
        original_start_date DATE, actual_start_date DATE,
        original_completion_date DATE, revised_completion_date DATE,
        percent_complete INTEGER DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
        safety_incidents INTEGER DEFAULT 0, safety_hours_worked DECIMAL(10,2) DEFAULT 0,
        subcontractors TEXT[],
        abca_permit_number TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cpm_task (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES cpm_project(id) ON DELETE CASCADE,
        task_name TEXT NOT NULL, trade TEXT
          CHECK (trade IN ('general','civil','concrete','framing','electrical','plumbing','hvac','drywalling','insulation','roofing','windows','flooring','painting','landscaping','other')),
        assigned_to TEXT, start_date DATE, end_date DATE,
        status TEXT DEFAULT 'not_started'
          CHECK (status IN ('not_started','in_progress','completed','blocked','on_hold')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
        completion_pct INTEGER DEFAULT 0, dependencies TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cpm_rfis (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES cpm_project(id) ON DELETE CASCADE,
        rfi_number TEXT NOT NULL, subject TEXT NOT NULL, trade TEXT,
        submitted_by TEXT, submitted_date DATE DEFAULT CURRENT_DATE,
        directed_to TEXT, response_required_by DATE,
        description TEXT, response TEXT, response_date DATE,
        status TEXT DEFAULT 'open' CHECK (status IN ('open','pending_response','answered','closed')),
        cost_impact DECIMAL(10,2) DEFAULT 0, schedule_impact_days INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM cpm_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO cpm_client (company_name, contact_name, contact_email, contact_phone, city, client_type, status)
        VALUES
          ('Redstone Developments Ltd.', 'Mike Redstone', 'mike@redstonedev.ca', '403-555-0101', 'Calgary', 'commercial', 'active'),
          ('Prairie Infrastructure Corp.', 'Sandra Olson', 'solson@prairieinf.ca', '403-555-0202', 'Calgary', 'municipal', 'active'),
          ('Foothills Custom Homes', 'Tom Barnett', 'tom@foothillshomes.ca', '403-555-0303', 'Calgary', 'residential', 'active')
      `);
      await client.query(`
        INSERT INTO cpm_project (client_id, project_name, project_number, project_type, city, project_manager, superintendent, status, contract_value, original_start_date, original_completion_date, percent_complete, safety_hours_worked)
        VALUES
          (1, 'Beltline Mixed-Use Tower', 'CPM-2026-001', 'new_build', 'Calgary', 'Jennifer Walsh', 'Derek Sandhu', 'active', 12500000.00, '2026-03-01', '2027-06-30', 42, 8400.5),
          (2, 'Glenmore Trail Bridge Rehabilitation', 'CPM-2026-002', 'infrastructure', 'Calgary', 'Carlos Medina', 'Bill Armstrong', 'active', 4800000.00, '2026-05-15', '2026-11-30', 28, 3200.0),
          (1, 'Southland Industrial Warehouse', 'CPM-2026-003', 'industrial', 'Calgary', 'Jennifer Walsh', 'Roy Chen', 'pre_construction', 7200000.00, '2026-10-01', '2027-04-30', 5, 0),
          (3, 'Edgemont Custom Residence', 'CPM-2026-004', 'new_build', 'Calgary', 'Carlos Medina', 'Kevin Park', 'active', 1850000.00, '2026-04-01', '2026-12-15', 68, 2100.0)
      `);
      await client.query(`
        INSERT INTO cpm_task (project_id, task_name, trade, assigned_to, start_date, end_date, status, priority, completion_pct)
        VALUES
          (1, 'Foundation Concrete Pour - Phase 2', 'concrete', 'Apex Concrete Ltd.', '2026-09-10', '2026-09-25', 'in_progress', 'critical', 65),
          (1, 'Structural Steel Erection - Floors 3-6', 'general', 'Rocky Mountain Steel', '2026-09-20', '2026-10-30', 'not_started', 'high', 0),
          (1, 'Electrical Rough-In - Floors 1-3', 'electrical', 'Precision Electric', '2026-09-15', '2026-10-10', 'in_progress', 'high', 40),
          (4, 'Framing - Main Floor', 'framing', 'Summit Framing', '2026-08-15', '2026-09-05', 'completed', 'high', 100),
          (4, 'Plumbing Rough-In', 'plumbing', 'Clear Flow Plumbing', '2026-09-01', '2026-09-20', 'in_progress', 'medium', 80)
      `);
      await client.query(`
        INSERT INTO cpm_rfis (project_id, rfi_number, subject, trade, submitted_by, submitted_date, directed_to, response_required_by, description, status)
        VALUES
          (1, 'RFI-001', 'Concrete Mix Design Clarification', 'concrete', 'Derek Sandhu', '2026-09-05', 'Structural Engineer', '2026-09-12', 'Clarification needed on concrete mix design specification for P3 columns — 35 MPa vs 40 MPa per drawings conflict.', 'pending_response'),
          (1, 'RFI-002', 'Mechanical Shaft Coordination', 'hvac', 'Jennifer Walsh', '2026-09-10', 'Mechanical Consultant', '2026-09-17', 'HVAC shaft dimensions on mechanical drawings conflict with structural drawings at gridline C-4.', 'open'),
          (4, 'RFI-001', 'Window Flashing Detail', 'windows', 'Kevin Park', '2026-09-08', 'Architect', '2026-09-15', 'Window flashing detail not specified for the flush-frame windows at west elevation.', 'answered')
      `);
    }
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
      const [active, value, behind, rfis, safety] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM cpm_project WHERE status IN ('active','pre_construction','awarded')`),
        client.query(`SELECT COALESCE(SUM(contract_value + COALESCE(change_orders_total,0)),0) AS total FROM cpm_project WHERE status IN ('active','pre_construction','awarded')`),
        client.query(`SELECT COUNT(*) AS n FROM cpm_project WHERE status = 'active' AND revised_completion_date IS NOT NULL AND revised_completion_date > original_completion_date`),
        client.query(`SELECT COUNT(*) AS n FROM cpm_rfis WHERE status IN ('open','pending_response')`),
        client.query(`SELECT COALESCE(SUM(safety_incidents),0) AS n FROM cpm_project WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`),
      ]);
      return Response.json({
        active_projects: parseInt(active.rows[0].n, 10),
        total_contract_value_active: parseFloat(value.rows[0].total),
        projects_behind_schedule: parseInt(behind.rows[0].n, 10),
        open_rfis: parseInt(rfis.rows[0].n, 10),
        safety_incidents_ytd: parseInt(safety.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

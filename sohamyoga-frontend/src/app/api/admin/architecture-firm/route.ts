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
      CREATE TABLE IF NOT EXISTS arch_client (
        id SERIAL PRIMARY KEY, company_name TEXT, contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL, contact_phone TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        client_type TEXT DEFAULT 'private' CHECK (client_type IN ('private','developer','municipal','institutional','industrial','commercial')),
        total_projects INTEGER DEFAULT 0, total_fees DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','prospect','inactive')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS arch_project (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES arch_client(id),
        project_name TEXT NOT NULL, project_number TEXT UNIQUE NOT NULL,
        project_type TEXT NOT NULL CHECK (project_type IN ('residential','multi_family','commercial','institutional','industrial','landscape','interior','mixed_use','renovation','master_planning')),
        project_phase TEXT DEFAULT 'schematic_design'
          CHECK (project_phase IN ('pre_design','schematic_design','design_development','construction_documents','permit','bidding','construction_administration','closeout','on_hold')),
        principal TEXT, project_architect TEXT, project_designer TEXT,
        site_address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        gross_area_sqft INTEGER, floors INTEGER,
        contract_type TEXT DEFAULT 'percentage' CHECK (contract_type IN ('percentage','fixed_fee','hourly','hybrid')),
        total_fee DECIMAL(12,2), fee_percentage DECIMAL(5,2),
        billed_to_date DECIMAL(12,2) DEFAULT 0, outstanding_balance DECIMAL(12,2) DEFAULT 0,
        construction_budget DECIMAL(14,2), construction_start DATE, construction_end DATE,
        permit_submitted DATE, permit_issued DATE, permit_number TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS arch_deliverable (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES arch_project(id) ON DELETE CASCADE,
        deliverable_name TEXT NOT NULL, deliverable_type TEXT
          CHECK (deliverable_type IN ('drawing','report','specification','presentation','permit_submission','RFI_response','site_visit_report','addendum','other')),
        phase TEXT, due_date DATE, submitted_date DATE,
        revision TEXT DEFAULT 'A' CHECK (revision IN ('A','B','C','D','E','F')),
        status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','approved','revision_required','issued_for_construction')),
        assigned_to TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS arch_time_entry (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES arch_project(id),
        staff_name TEXT NOT NULL, entry_date DATE NOT NULL,
        phase TEXT, task_description TEXT NOT NULL,
        hours DECIMAL(5,2) NOT NULL, hourly_rate DECIMAL(10,2),
        billable BOOLEAN DEFAULT true, billed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM arch_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO arch_client (company_name, contact_name, contact_email, contact_phone, city, client_type, status)
        VALUES
          ('Apex Developments Inc.', 'Robert Chen', 'rchen@apexdev.ca', '403-555-0101', 'Calgary', 'developer', 'active'),
          ('City of Calgary - Engineering', 'Amanda Torres', 'atorres@calgary.ca', '403-555-0202', 'Calgary', 'municipal', 'active'),
          ('Singh Residence', 'Priya Singh', 'priya.singh@gmail.com', '403-555-0303', 'Calgary', 'private', 'active'),
          ('Foothills Medical Centre', 'Dr. Brian Hall', 'bhall@fmc.ca', '403-555-0404', 'Calgary', 'institutional', 'active')
      `);
      await client.query(`
        INSERT INTO arch_project (client_id, project_name, project_number, project_type, project_phase, principal, project_architect, city, gross_area_sqft, floors, contract_type, total_fee, fee_percentage, billed_to_date, outstanding_balance, construction_budget, status)
        VALUES
          (1, 'Mission District Mixed-Use', 'ARCH-2026-001', 'mixed_use', 'construction_documents', 'Maria Kowalski, OAA', 'Derek Wong', 'Calgary', 45000, 8, 'percentage', 1250000, 3.5, 875000, 375000, 35700000, 'active'),
          (2, 'Bow River Pedestrian Bridge', 'ARCH-2026-002', 'landscape', 'schematic_design', 'Maria Kowalski, OAA', 'Lisa Park', 'Calgary', 8000, 1, 'fixed_fee', 320000, NULL, 80000, 240000, 4800000, 'active'),
          (3, 'Elbow Park Custom Residence', 'ARCH-2026-003', 'residential', 'construction_administration', 'Tom Fairfax, OAA', 'Anna Lee', 'Calgary', 6200, 2, 'percentage', 185000, 8.0, 148000, 37000, 2310000, 'active'),
          (4, 'Oncology Clinic Renovation', 'ARCH-2026-004', 'institutional', 'permit', 'Maria Kowalski, OAA', 'Derek Wong', 'Calgary', 12500, 2, 'fixed_fee', 480000, NULL, 384000, 96000, 3200000, 'active')
      `);
      await client.query(`
        INSERT INTO arch_deliverable (project_id, deliverable_name, deliverable_type, phase, due_date, revision, status, assigned_to)
        VALUES
          (1, 'Architectural Floor Plans - All Levels', 'drawing', 'construction_documents', '2026-09-25', 'B', 'in_progress', 'Derek Wong'),
          (1, 'Permit Submission Package', 'permit_submission', 'permit', '2026-10-15', 'A', 'in_progress', 'Lisa Park'),
          (3, 'Construction Set - Issued for Construction', 'drawing', 'construction_administration', '2026-09-10', 'C', 'issued_for_construction', 'Anna Lee'),
          (4, 'Development Permit Application', 'permit_submission', 'permit', '2026-09-05', 'A', 'submitted', 'Derek Wong'),
          (2, 'Schematic Design Report', 'report', 'schematic_design', '2026-10-01', 'A', 'in_progress', 'Lisa Park')
      `);
      await client.query(`
        INSERT INTO arch_time_entry (project_id, staff_name, entry_date, phase, task_description, hours, hourly_rate, billable)
        VALUES
          (1, 'Derek Wong', '2026-09-13', 'construction_documents', 'Floor plan coordination — Level 3 parking', 6.5, 145, true),
          (1, 'Lisa Park', '2026-09-13', 'construction_documents', 'Permit package assembly', 4.0, 115, true),
          (3, 'Anna Lee', '2026-09-12', 'construction_administration', 'Site visit and deficiency review', 3.5, 125, true),
          (4, 'Derek Wong', '2026-09-11', 'permit', 'Permit submission coordination with City', 2.0, 145, true),
          (2, 'Lisa Park', '2026-09-10', 'schematic_design', 'Concept diagrams and site analysis', 8.0, 115, true)
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
      const [active, wip, permits, overdue, revenue] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM arch_project WHERE status = 'active'`),
        client.query(`SELECT COALESCE(SUM(outstanding_balance),0) AS total FROM arch_project WHERE status = 'active'`),
        client.query(`SELECT COUNT(*) AS n FROM arch_project WHERE project_phase = 'permit' AND permit_issued IS NULL`),
        client.query(`SELECT COUNT(*) AS n FROM arch_deliverable WHERE status = 'in_progress' AND due_date < CURRENT_DATE`),
        client.query(`SELECT COALESCE(SUM(t.hours * t.hourly_rate),0) AS total FROM arch_time_entry t WHERE EXTRACT(MONTH FROM t.entry_date) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM t.entry_date) = EXTRACT(YEAR FROM NOW()) AND t.billable = true`),
      ]);
      return Response.json({
        active_projects: parseInt(active.rows[0].n, 10),
        wip_value: parseFloat(wip.rows[0].total),
        permit_applications_pending: parseInt(permits.rows[0].n, 10),
        deliverables_overdue: parseInt(overdue.rows[0].n, 10),
        revenue_mtd: parseFloat(revenue.rows[0].total),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

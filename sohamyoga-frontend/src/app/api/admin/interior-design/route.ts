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
      CREATE TABLE IF NOT EXISTS id_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT,
        project_address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        client_type TEXT DEFAULT 'residential' CHECK (client_type IN ('residential','commercial','hospitality','healthcare','office','retail','model_suite','staging')),
        style_preferences TEXT[], color_palette TEXT[],
        budget_range TEXT CHECK (budget_range IN ('economy','mid_range','upper_mid','luxury','ultra_luxury')),
        project_timeline TEXT, family_composition TEXT,
        must_haves TEXT[], deal_breakers TEXT[],
        total_projects INTEGER DEFAULT 0, total_spent DECIMAL(12,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS id_project (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES id_client(id),
        project_name TEXT NOT NULL,
        project_type TEXT NOT NULL CHECK (project_type IN ('full_home','single_room','renovation','staging','commercial_office','retail_space','hospitality','model_suite')),
        rooms_included TEXT[] NOT NULL,
        designer TEXT, status TEXT DEFAULT 'discovery'
          CHECK (status IN ('discovery','concept','design_development','procurement','installation','completed','on_hold')),
        total_fee DECIMAL(10,2), deposit_paid DECIMAL(10,2) DEFAULT 0,
        budget_furniture DECIMAL(12,2), budget_actual DECIMAL(12,2) DEFAULT 0,
        start_date DATE, completion_date DATE,
        style TEXT CHECK (style IN ('modern','contemporary','traditional','transitional','scandinavian','bohemian','industrial','coastal','farmhouse','art_deco','minimalist','eclectic')),
        mood_board_url TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS id_item (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES id_project(id) ON DELETE CASCADE,
        room TEXT NOT NULL, item_name TEXT NOT NULL, category TEXT
          CHECK (category IN ('sofa','chair','table','bed','storage','lighting','rug','artwork','window_treatment','accessory','plant','flooring','tile','paint','wallpaper','hardware','appliance','other')),
        supplier TEXT, model_sku TEXT, finish TEXT, dimensions TEXT, quantity INTEGER DEFAULT 1,
        unit_cost DECIMAL(10,2), unit_retail DECIMAL(10,2), designer_markup_pct DECIMAL(5,2) DEFAULT 30,
        status TEXT DEFAULT 'specified' CHECK (status IN ('specified','approved','ordered','on_backorder','received','installed','returned')),
        lead_time_weeks INTEGER, order_date DATE, expected_delivery DATE, received_date DATE,
        notes TEXT, image_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS id_vendor (
        id SERIAL PRIMARY KEY, vendor_name TEXT NOT NULL, vendor_type TEXT
          CHECK (vendor_type IN ('furniture','lighting','flooring','fabric','art','accessories','paint','tile','appliance','window','contractor','other')),
        contact_name TEXT, phone TEXT, email TEXT, website TEXT,
        trade_discount_pct DECIMAL(5,2) DEFAULT 0, payment_terms TEXT,
        lead_time_typical TEXT, quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
        notes TEXT, is_preferred BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM id_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO id_client (first_name, last_name, email, phone, city, client_type, style_preferences, color_palette, budget_range, must_haves, notes)
        VALUES
          ('Sarah', 'Thompson', 'sarah.t@gmail.com', '403-555-0101', 'Calgary', 'residential', ARRAY['modern','minimalist'], ARRAY['white','oak','charcoal'], 'luxury', ARRAY['high ceilings feel','statement lighting','integrated storage'], 'New build in Aspen Woods — moving in Dec 2026'),
          ('Marco', 'Rossi', 'marco.rossi@company.ca', '403-555-0202', 'Calgary', 'commercial', ARRAY['contemporary','industrial'], ARRAY['navy','brass','warm white'], 'upper_mid', ARRAY['collaborative zones','branded accent wall'], 'Tech startup 3,500 sq ft office — Beltline'),
          ('Diane', 'Kim', 'dkim@email.ca', '403-555-0303', 'Calgary', 'staging', ARRAY['transitional'], ARRAY['greige','white','warm wood'], 'mid_range', ARRAY['neutral','wide appeal','photogenic'], 'Listing in Altadore — need quick turnaround'),
          ('The Laurent', 'Hotel Group', 'design@laurenthotels.ca', '403-555-0404', 'Calgary', 'hospitality', ARRAY['art_deco','eclectic'], ARRAY['emerald','gold','cream'], 'ultra_luxury', ARRAY['bespoke pieces','locally sourced art'], '18-suite boutique hotel renovation')
      `);
      await client.query(`
        INSERT INTO id_project (client_id, project_name, project_type, rooms_included, designer, status, total_fee, deposit_paid, budget_furniture, budget_actual, start_date, completion_date, style)
        VALUES
          (1, 'Thompson Aspen Woods Residence', 'full_home', ARRAY['living room','kitchen','primary bedroom','guest bedroom','home office','powder room'], 'Chloe Beaumont', 'procurement', 18500, 9250, 120000, 68400, '2026-06-01', '2026-11-30', 'modern'),
          (2, 'Rossi Tech HQ — Beltline', 'commercial_office', ARRAY['reception','open work','boardroom','lounge','kitchen'], 'James Park', 'design_development', 12000, 6000, 85000, 22000, '2026-08-15', '2026-12-15', 'contemporary'),
          (3, 'Kim Altadore Staging', 'staging', ARRAY['living room','dining room','primary bedroom','second bedroom'], 'Chloe Beaumont', 'installation', 4800, 4800, 28000, 27200, '2026-09-10', '2026-09-25', 'transitional'),
          (4, 'Laurent Hotel — Lobby & Suites', 'hospitality', ARRAY['lobby','bar','suite 101','suite 102','suite 103'], 'James Park', 'concept', 45000, 15000, 380000, 12000, '2026-09-15', '2027-03-31', 'art_deco')
      `);
      await client.query(`
        INSERT INTO id_item (project_id, room, item_name, category, supplier, finish, quantity, unit_cost, unit_retail, designer_markup_pct, status, lead_time_weeks, expected_delivery)
        VALUES
          (1, 'living room', 'Cassina LC2 Sofa — 3-seater', 'sofa', 'Inform Interiors', 'White leather', 1, 6200, 8060, 30, 'ordered', 10, '2026-10-15'),
          (1, 'living room', 'Flos Arco Floor Lamp', 'lighting', 'EQ3 Calgary', 'Black/marble', 1, 1850, 2405, 30, 'received', 4, '2026-09-20'),
          (1, 'primary bedroom', 'Custom King Platform Bed — white oak', 'bed', 'Workshop APD', 'White oak natural', 1, 4800, 6240, 30, 'ordered', 12, '2026-10-28'),
          (2, 'boardroom', 'Herman Miller Embody Chair', 'chair', 'Atmosphere Commercial', 'Charcoal Balance', 12, 1550, 2015, 30, 'approved', 6, '2026-10-20'),
          (2, 'reception', 'Custom Reception Desk — bent steel + walnut', 'table', 'Workshop APD', 'Black steel + oiled walnut', 1, 8500, 11050, 30, 'specified', NULL, NULL),
          (3, 'living room', 'West Elm Harmony Sectional', 'sofa', 'West Elm Calgary', 'Ivory', 1, 2800, 3640, 30, 'installed', 3, '2026-09-12'),
          (4, 'lobby', 'Custom Terrazzo Flooring — Emerald & Cream', 'flooring', 'Tile Artisan Calgary', 'Emerald terrazzo', 1, 28000, 36400, 30, 'specified', 16, NULL)
      `);
      await client.query(`
        INSERT INTO id_vendor (vendor_name, vendor_type, contact_name, phone, email, website, trade_discount_pct, lead_time_typical, quality_rating, is_preferred)
        VALUES
          ('Inform Interiors', 'furniture', 'Rachel Brown', '604-555-0101', 'trade@inform.ca', 'informinteriors.com', 30, '8-12 weeks', 5, true),
          ('EQ3 Calgary', 'furniture', 'Tyler Nguyen', '403-555-0201', 'calgary@eq3.ca', 'eq3.com', 20, '4-6 weeks', 4, true),
          ('Workshop APD', 'furniture', 'Dave Arseneau', '403-555-0301', 'hello@workshopapd.ca', 'workshopapd.ca', 25, '10-14 weeks custom', 5, true),
          ('Atmosphere Commercial', 'furniture', 'Karen Lee', '403-555-0401', 'calgary@atmosphere.ca', 'atmospherecommercial.com', 35, '6-8 weeks', 4, true),
          ('Tile Artisan Calgary', 'tile', 'Mike Vasquez', '403-555-0501', 'info@tileartisan.ca', 'tileartisan.ca', 15, '4-16 weeks', 5, true),
          ('West Elm Calgary', 'furniture', 'Store Team', '403-555-0601', 'calgary@westelm.ca', 'westelm.com', 15, '3-6 weeks', 3, false),
          ('Restoration Hardware Calgary', 'furniture', 'Trade Team', '403-555-0701', 'calgary@rh.com', 'rh.com', 25, '6-10 weeks', 5, false)
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
      const [active, onOrder, overdue, revenue, avgVal] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM id_project WHERE status NOT IN ('completed','on_hold')`),
        client.query(`SELECT COUNT(*) AS n FROM id_item WHERE status IN ('ordered','on_backorder')`),
        client.query(`SELECT COUNT(*) AS n FROM id_item WHERE status IN ('ordered','on_backorder') AND expected_delivery IS NOT NULL AND expected_delivery < CURRENT_DATE`),
        client.query(`SELECT COALESCE(SUM(total_fee),0) AS total FROM id_project WHERE EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NOW())`),
        client.query(`SELECT COALESCE(AVG(total_fee),0) AS avg FROM id_project`),
      ]);
      return Response.json({
        active_projects: parseInt(active.rows[0].n, 10),
        items_on_order: parseInt(onOrder.rows[0].n, 10),
        items_overdue_delivery: parseInt(overdue.rows[0].n, 10),
        revenue_mtd: parseFloat(revenue.rows[0].total),
        avg_project_value: parseFloat(avgVal.rows[0].avg),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

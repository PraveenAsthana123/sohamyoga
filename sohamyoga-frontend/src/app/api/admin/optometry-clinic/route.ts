import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS opt_patient (
      id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      date_of_birth DATE NOT NULL, health_card_number TEXT,
      phone TEXT NOT NULL, email TEXT, address TEXT,
      city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', postal_code TEXT,
      insurance_provider TEXT, insurance_id TEXT, insurance_group TEXT,
      occupation TEXT, general_health_conditions TEXT[],
      current_medications TEXT[], allergies TEXT[],
      family_eye_history TEXT,
      last_exam_date DATE, next_recall_date DATE, recall_interval_months INTEGER DEFAULT 12,
      patient_since DATE DEFAULT CURRENT_DATE, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS opt_exam (
      id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES opt_patient(id),
      exam_date DATE NOT NULL, optometrist TEXT NOT NULL,
      exam_type TEXT DEFAULT 'comprehensive'
        CHECK (exam_type IN ('comprehensive','contact_lens','follow_up','emergency','pediatric','low_vision')),
      chief_complaint TEXT,
      od_sphere DECIMAL(5,2), od_cylinder DECIMAL(5,2), od_axis INTEGER, od_add DECIMAL(5,2), od_prism TEXT,
      os_sphere DECIMAL(5,2), os_cylinder DECIMAL(5,2), os_axis INTEGER, os_add DECIMAL(5,2), os_prism TEXT,
      od_visual_acuity TEXT, os_visual_acuity TEXT, binocular_va TEXT,
      od_iop DECIMAL(5,1), os_iop DECIMAL(5,1),
      pupil_distance DECIMAL(5,1), near_pd DECIMAL(5,1),
      diagnosis TEXT[], recommendations TEXT[],
      lens_type TEXT, frame_recommendation TEXT,
      contact_lens_brand TEXT, contact_base_curve DECIMAL(4,2), contact_diameter DECIMAL(4,2),
      follow_up_required BOOLEAN DEFAULT false, follow_up_weeks INTEGER,
      alberta_health_covered BOOLEAN DEFAULT true, additional_tests_ordered TEXT[],
      total_fee DECIMAL(10,2), insurance_claimed DECIMAL(10,2), patient_paid DECIMAL(10,2),
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS opt_frame_inventory (
      id SERIAL PRIMARY KEY, brand TEXT NOT NULL, model TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL, color TEXT, size TEXT,
      frame_type TEXT CHECK (frame_type IN ('full_rim','semi_rim','rimless','sports','kids')),
      material TEXT, cost_price DECIMAL(10,2), retail_price DECIMAL(10,2),
      quantity_on_hand INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 2,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS opt_order (
      id SERIAL PRIMARY KEY, patient_id INTEGER REFERENCES opt_patient(id),
      exam_id INTEGER REFERENCES opt_exam(id),
      order_type TEXT NOT NULL CHECK (order_type IN ('glasses','contact_lenses','sunglasses','accessories','repair')),
      frame_sku TEXT, lens_type TEXT, lens_coating TEXT[],
      contact_brand TEXT, contact_quantity INTEGER,
      total_amount DECIMAL(10,2), deposit_paid DECIMAL(10,2) DEFAULT 0,
      insurance_claimed DECIMAL(10,2) DEFAULT 0, patient_balance DECIMAL(10,2),
      status TEXT DEFAULT 'ordered' CHECK (status IN ('ordered','lab','ready','dispensed','cancelled')),
      lab_reference TEXT, expected_ready_date DATE, dispensed_date DATE,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const today = new Date().toISOString().slice(0, 10);
    const [examsToday, recallsDue, ordersInLab, framesLowStock, revenueMtd] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM opt_exam WHERE exam_date = $1`, [today]),
      client.query(`SELECT COUNT(*) AS n FROM opt_patient WHERE next_recall_date <= NOW() + INTERVAL '30 days' AND next_recall_date >= NOW()`),
      client.query(`SELECT COUNT(*) AS n FROM opt_order WHERE status = 'lab'`),
      client.query(`SELECT COUNT(*) AS n FROM opt_frame_inventory WHERE quantity_on_hand <= reorder_point AND is_active = true`),
      client.query(`SELECT COALESCE(SUM(patient_paid),0) AS total FROM opt_exam WHERE DATE_TRUNC('month', exam_date) = DATE_TRUNC('month', NOW())`),
    ]);
    return Response.json({
      exams_today: parseInt(examsToday.rows[0].n, 10),
      recalls_due_30d: parseInt(recallsDue.rows[0].n, 10),
      orders_in_lab: parseInt(ordersInLab.rows[0].n, 10),
      frames_low_stock: parseInt(framesLowStock.rows[0].n, 10),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
    });
  } finally { client.release(); }
}

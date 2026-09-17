import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureCoreTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS dn_dietitians (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text NOT NULL,
        phone text,
        cda_registration_number text,
        registration_expiry date,
        specialties text[],
        status text DEFAULT 'active',
        notes text,
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS dn_clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name text NOT NULL,
        last_name text NOT NULL,
        date_of_birth date,
        email text,
        phone text,
        referral_source text,
        primary_health_condition text,
        height_cm numeric,
        weight_kg numeric,
        bmi numeric GENERATED ALWAYS AS (
          CASE WHEN height_cm > 0 THEN weight_kg / ((height_cm/100)*(height_cm/100)) ELSE NULL END
        ) STORED,
        allergies text[],
        food_intolerances text[],
        medications text[],
        corporate_plan_name text,
        status text DEFAULT 'active',
        notes text,
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS dn_appointments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES dn_clients(id),
        dietitian_id uuid REFERENCES dn_dietitians(id),
        appointment_type text DEFAULT 'follow_up',
        appointment_date date NOT NULL,
        start_time time NOT NULL,
        duration_minutes int DEFAULT 60,
        status text DEFAULT 'scheduled',
        weight_recorded_kg numeric,
        session_notes text,
        goals_reviewed text[],
        next_steps text[],
        follow_up_date date,
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS dn_nutrition_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES dn_clients(id),
        dietitian_id uuid REFERENCES dn_dietitians(id),
        plan_name text NOT NULL,
        plan_type text,
        calorie_target int,
        protein_target_g int,
        carb_target_g int,
        fat_target_g int,
        key_recommendations text[],
        foods_to_limit text[],
        supplement_recommendations text[],
        review_date date,
        status text DEFAULT 'active',
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS dn_weight_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES dn_clients(id),
        recorded_at timestamptz DEFAULT now(),
        weight_kg numeric NOT NULL,
        notes text
      );
      CREATE TABLE IF NOT EXISTS dn_corporate_contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name text NOT NULL,
        contact_name text,
        contact_email text,
        services_included text[],
        sessions_per_year int,
        price_per_session numeric,
        contract_value numeric,
        start_date date,
        end_date date,
        status text DEFAULT 'active',
        notes text,
        created_at timestamptz DEFAULT now()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  await ensureCoreTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [totalClients, apptThisWeek, activePlans, corpClients, revenueMtd, pendingAssessments] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM dn_clients WHERE status='active'`),
      client.query(`SELECT COUNT(*) FROM dn_appointments WHERE appointment_date BETWEEN $1 AND $2`, [weekStart.toISOString().slice(0,10), weekEnd.toISOString().slice(0,10)]),
      client.query(`SELECT COUNT(*) FROM dn_nutrition_plans WHERE status='active'`),
      client.query(`SELECT COUNT(DISTINCT id) FROM dn_clients WHERE corporate_plan_name IS NOT NULL AND status='active'`),
      client.query(`SELECT COALESCE(SUM(price_per_session), 0) as total FROM dn_corporate_contracts WHERE status='active' AND start_date <= $1`, [now.toISOString().slice(0,10)]),
      client.query(`SELECT COUNT(*) FROM dn_appointments WHERE status='scheduled' AND appointment_date < $1`, [now.toISOString().slice(0,10)]),
    ]);

    return Response.json({
      total_clients: parseInt(totalClients.rows[0].count),
      appointments_this_week: parseInt(apptThisWeek.rows[0].count),
      active_nutrition_plans: parseInt(activePlans.rows[0].count),
      corporate_clients_count: parseInt(corpClients.rows[0].count),
      revenue_mtd: parseFloat(revenueMtd.rows[0].total),
      pending_assessments: parseInt(pendingAssessments.rows[0].count),
    });
  } finally { client.release(); }
}

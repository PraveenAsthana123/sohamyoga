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
      CREATE TABLE IF NOT EXISTS spa_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, date_of_birth DATE,
        health_conditions TEXT[], medications TEXT[], allergies TEXT[],
        contraindications TEXT, pressure_preference TEXT DEFAULT 'medium'
          CHECK (pressure_preference IN ('light','medium','firm','deep_tissue')),
        preferred_therapist TEXT, referral_source TEXT,
        intake_form_signed BOOLEAN DEFAULT false, intake_form_date DATE,
        loyalty_points INTEGER DEFAULT 0, total_visits INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0, last_visit DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spa_service (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL
          CHECK (category IN ('massage','facial','body_treatment','hot_stone','reflexology','reiki','cupping','prenatal','sports','couples','other')),
        description TEXT, duration_minutes INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL, therapist_requirements TEXT,
        room_required TEXT, supplies_needed TEXT[],
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spa_appointment (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES spa_client(id),
        service_id INTEGER REFERENCES spa_service(id),
        therapist TEXT NOT NULL, room TEXT,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status TEXT DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','confirmed','intake_complete','in_progress','completed','cancelled','no_show')),
        intake_notes TEXT, pressure_used TEXT, areas_focused TEXT[],
        aftercare_given TEXT, client_feedback TEXT, client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5),
        amount DECIMAL(10,2), tip DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT CHECK (payment_method IN ('cash','credit','debit','etransfer','gift_card','insurance')),
        massage_benefit_claimed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spa_gift_card (
        id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, purchaser_name TEXT,
        purchaser_email TEXT, recipient_name TEXT, recipient_email TEXT,
        initial_amount DECIMAL(10,2) NOT NULL, remaining_balance DECIMAL(10,2) NOT NULL,
        expiry_date DATE, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM spa_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO spa_service (name, category, description, duration_minutes, price, therapist_requirements, room_required, supplies_needed)
        VALUES
          ('Swedish Relaxation Massage','massage','Full-body relaxation massage with long flowing strokes',60,95.00,'RMT','Room A',ARRAY['oil','towels','blanket']),
          ('Deep Tissue Massage','massage','Targets deep muscle layers for chronic tension relief',90,140.00,'RMT','Room A',ARRAY['oil','hot towels']),
          ('Hot Stone Massage','hot_stone','Basalt stones combined with Swedish techniques',75,120.00,'RMT certified hot stone','Room B',ARRAY['basalt stones','oil','towels']),
          ('Prenatal Massage','prenatal','Side-lying massage for expectant mothers',60,100.00,'Prenatal certified RMT','Room B',ARRAY['body pillow','oil','towels']),
          ('Sports Recovery Massage','sports','Targeted therapy for athletic recovery',60,110.00,'RMT','Room A',ARRAY['oil','ice pack','towels']),
          ('Couples Massage','couples','Simultaneous massage for two in the same room',60,190.00,'2x RMT','Suite',ARRAY['oil','towels','candles']),
          ('Reflexology','reflexology','Foot reflexology for whole-body wellness',45,75.00,'Reflexology cert','Room C',ARRAY['lotion','towels']),
          ('Reiki Healing','reiki','Energy healing session',60,85.00,'Reiki master','Room C',ARRAY['crystals','music']),
          ('Classic Facial','facial','Deep cleansing facial with extraction',60,95.00,'Esthetician','Room D',ARRAY['cleanser','toner','mask','moisturizer']),
          ('Cupping Therapy','cupping','Myofascial decompression with silicone cups',45,85.00,'Cupping certified RMT','Room A',ARRAY['cups','oil'])
      `);
      await client.query(`
        INSERT INTO spa_client (first_name, last_name, email, phone, pressure_preference, preferred_therapist, intake_form_signed, loyalty_points, total_visits, total_spent)
        VALUES
          ('Sarah','Thompson','sarah.t@email.ca','403-555-0101','medium','Emma Wilson RMT',true,120,12,1140.00),
          ('James','Kowalski','james.k@email.ca','403-555-0202','deep_tissue','Emma Wilson RMT',true,85,8,780.00),
          ('Priya','Sharma','priya.s@email.ca','403-555-0303','light','Mark Chen RMT',true,40,4,380.00),
          ('Robert','Dubois','robert.d@email.ca','403-555-0404','firm',NULL,false,0,0,0.00)
      `);
      await client.query(`
        INSERT INTO spa_gift_card (code, purchaser_name, purchaser_email, recipient_name, initial_amount, remaining_balance, expiry_date, is_active)
        VALUES
          ('SPA2024AB','John Smith','john@email.ca','Jane Smith',150.00,150.00,CURRENT_DATE + INTERVAL '1 year',true),
          ('SPA2024CD','Mary Jones','mary@email.ca','Bob Jones',100.00,65.00,CURRENT_DATE + INTERVAL '1 year',true),
          ('SPA2024EF','Linda Brown','linda@email.ca','Tom Brown',200.00,0.00,CURRENT_DATE - INTERVAL '30 days',false)
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
      const today = new Date().toISOString().split('T')[0];
      const [appts, revenue, rating, giftCards] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM spa_appointment WHERE DATE(scheduled_at)=$1 AND status NOT IN ('cancelled','no_show')`, [today]),
        client.query(`SELECT COALESCE(SUM(amount),0) AS revenue, COALESCE(SUM(tip),0) AS tips FROM spa_appointment WHERE DATE(scheduled_at)=$1 AND status='completed'`, [today]),
        client.query(`SELECT ROUND(AVG(client_rating),1) AS avg_rating FROM spa_appointment WHERE DATE_TRUNC('month',scheduled_at)=DATE_TRUNC('month',NOW()) AND client_rating IS NOT NULL`),
        client.query(`SELECT COALESCE(SUM(remaining_balance),0) AS outstanding FROM spa_gift_card WHERE is_active=true`),
      ]);
      return Response.json({
        appointments_today: parseInt(appts.rows[0].n, 10),
        revenue_today: parseFloat(revenue.rows[0].revenue),
        tips_today: parseFloat(revenue.rows[0].tips),
        revenue_today_with_tips: parseFloat(revenue.rows[0].revenue) + parseFloat(revenue.rows[0].tips),
        avg_rating_mtd: parseFloat(rating.rows[0].avg_rating) || 0,
        gift_cards_outstanding_value: parseFloat(giftCards.rows[0].outstanding),
      });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

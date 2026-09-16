export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS affiliate_ai_partners (
    id SERIAL PRIMARY KEY, name TEXT, niche TEXT, audience_size INTEGER DEFAULT 0,
    conversion_rate NUMERIC DEFAULT 0, ai_match_score NUMERIC DEFAULT 0,
    recommended_commission NUMERIC DEFAULT 0, status TEXT DEFAULT 'candidate', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS affiliate_creatives (
    id SERIAL PRIMARY KEY, partner_id INTEGER, format TEXT, headline TEXT, body TEXT, cta TEXT,
    ai_generated BOOLEAN DEFAULT TRUE, ctr_prediction NUMERIC DEFAULT 0, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS affiliate_offers (
    id SERIAL PRIMARY KEY, name TEXT, commission_type TEXT DEFAULT 'percentage', commission_value NUMERIC DEFAULT 10,
    cookie_days INTEGER DEFAULT 30, ai_optimized BOOLEAN DEFAULT FALSE, predicted_roi NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS affiliate_attribution (
    id SERIAL PRIMARY KEY, conversion_id TEXT, touchpoints JSONB, first_touch_partner TEXT,
    last_touch_partner TEXT, linear_credit JSONB, time_decay_credit JSONB, revenue NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS affiliate_payments (
    id SERIAL PRIMARY KEY, partner_name TEXT, amount NUMERIC DEFAULT 0, currency TEXT DEFAULT 'CAD',
    status TEXT DEFAULT 'pending', tax_form TEXT, payment_method TEXT DEFAULT 'bank_transfer',
    due_date DATE, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM affiliate_ai_partners');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO affiliate_ai_partners (name, niche, audience_size, conversion_rate, ai_match_score, recommended_commission, status) VALUES
      ('WellnessHub Blog','health & wellness',85000,3.2,94,12,'active'),
      ('FitLife Podcast','fitness & nutrition',120000,4.1,89,10,'active'),
      ('MindfulMom Network','parenting & wellness',67000,5.8,91,15,'active'),
      ('YogaDaily.com','yoga & meditation',200000,2.9,86,10,'active'),
      ('HealthTech Review','digital health',45000,6.2,78,8,'candidate'),
      ('Wellness Warriors FB','social community',300000,1.8,72,8,'candidate')
    `);
    await client.query(`INSERT INTO affiliate_creatives (partner_id, format, headline, body, cta, ctr_prediction) VALUES
      (1,'banner','Transform Your Morning Routine','Join 10,000+ women who start their day with our expert-led yoga classes. First week free.','Start Free Trial',4.2),
      (1,'email','Your Body Deserves This','Science-backed yoga and meditation for busy professionals. Proven to reduce stress by 40%.','Learn More',3.8),
      (2,'social_post','Finally, Yoga That Fits Your Schedule','15-minute classes designed for real life. No studio, no commute, no excuses.','Get Started',5.1),
      (2,'video_ad','This Yoga App Changed My Life','Real stories from real people. See why 50,000+ members never look back.','Try Free',6.3),
      (3,'newsletter','Gift Card Special — Perfect for Moms','Give the gift of wellness this season. Digital gift cards from $25. Instant delivery.','Buy Now',7.2),
      (3,'banner','Corporate Wellness Solutions','Reduce employee sick days by 28%. Trusted by 200+ companies across Canada.','Book Demo',2.9),
      (4,'social_post','Free Community Yoga Event','Join our live Saturday sessions. Free for all levels. Your community is waiting.','RSVP Free',8.4),
      (4,'email','The 30-Day Yoga Challenge','Can you do it? 10 minutes a day for 30 days. Free tracking, free videos, real results.','Join Challenge',5.6)
    `);
    await client.query(`INSERT INTO affiliate_offers (name, commission_type, commission_value, cookie_days, ai_optimized, predicted_roi) VALUES
      ('Standard Membership Referral','percentage',10,30,false,320),
      ('Gift Card Promotion','flat',15,60,true,480),
      ('Corporate Package Lead','flat',50,90,true,850),
      ('Annual Plan Referral','percentage',15,45,false,560)
    `);
    await client.query(`INSERT INTO affiliate_attribution (conversion_id, touchpoints, first_touch_partner, last_touch_partner, linear_credit, time_decay_credit, revenue) VALUES
      ('conv_001','[{"partner":"WellnessHub Blog","channel":"organic"},{"partner":"FitLife Podcast","channel":"email"},{"partner":"YogaDaily.com","channel":"paid"}]','WellnessHub Blog','YogaDaily.com','{"WellnessHub Blog":33.3,"FitLife Podcast":33.3,"YogaDaily.com":33.3}','{"WellnessHub Blog":10,"FitLife Podcast":30,"YogaDaily.com":60}',99),
      ('conv_002','[{"partner":"MindfulMom Network","channel":"social"},{"partner":"WellnessHub Blog","channel":"referral"}]','MindfulMom Network','WellnessHub Blog','{"MindfulMom Network":50,"WellnessHub Blog":50}','{"MindfulMom Network":25,"WellnessHub Blog":75}',149),
      ('conv_003','[{"partner":"FitLife Podcast","channel":"email"}]','FitLife Podcast','FitLife Podcast','{"FitLife Podcast":100}','{"FitLife Podcast":100}',199),
      ('conv_004','[{"partner":"YogaDaily.com","channel":"seo"},{"partner":"MindfulMom Network","channel":"social"},{"partner":"FitLife Podcast","channel":"podcast"}]','YogaDaily.com','FitLife Podcast','{"YogaDaily.com":33.3,"MindfulMom Network":33.3,"FitLife Podcast":33.3}','{"YogaDaily.com":10,"MindfulMom Network":20,"FitLife Podcast":70}',299),
      ('conv_005','[{"partner":"WellnessHub Blog","channel":"content"}]','WellnessHub Blog','WellnessHub Blog','{"WellnessHub Blog":100}','{"WellnessHub Blog":100}',49)
    `);
    await client.query(`INSERT INTO affiliate_payments (partner_name, amount, currency, status, tax_form, payment_method, due_date) VALUES
      ('WellnessHub Blog',342.50,'CAD','pending','T4A','bank_transfer','2026-09-30'),
      ('FitLife Podcast',520.00,'CAD','paid','T4A','e-transfer','2026-09-15'),
      ('MindfulMom Network',187.25,'CAD','pending','T4A','bank_transfer','2026-09-30'),
      ('YogaDaily.com',95.00,'CAD','processing','T4A','paypal','2026-09-25'),
      ('Wellness Warriors FB',45.00,'CAD','pending','T4A','e-transfer','2026-09-30'),
      ('HealthTech Review',0.00,'CAD','on_hold',NULL,'bank_transfer','2026-10-15')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const [partners, stats] = await Promise.all([
      client.query('SELECT * FROM affiliate_ai_partners ORDER BY ai_match_score DESC'),
      client.query('SELECT COUNT(*) as total, COALESCE(AVG(ai_match_score),0) as avg_score, COALESCE(SUM(audience_size),0) as total_audience FROM affiliate_ai_partners'),
    ]);
    return Response.json({ partners: partners.rows, stats: stats.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `INSERT INTO affiliate_ai_partners (name, niche, audience_size, conversion_rate, ai_match_score, recommended_commission, status)
       VALUES ($1,$2,$3,$4,$5,$6,'candidate') RETURNING *`,
      [body.name, body.niche, body.audience_size || 0, body.conversion_rate || 0, body.ai_match_score || 0, body.recommended_commission || 10]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision() {
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS conversion_experiments (
      id SERIAL PRIMARY KEY, name TEXT, type TEXT, hypothesis TEXT,
      control_variant TEXT, test_variant TEXT, metric TEXT,
      status TEXT DEFAULT 'draft',
      control_conversions INTEGER DEFAULT 0, test_conversions INTEGER DEFAULT 0,
      control_visitors INTEGER DEFAULT 0, test_visitors INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS conversion_funnels (
      id SERIAL PRIMARY KEY, name TEXT, stages JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS conversion_offers (
      id SERIAL PRIMARY KEY, name TEXT, type TEXT, headline TEXT, cta TEXT,
      discount_pct INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
      conversions INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);

    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM conversion_experiments');
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`INSERT INTO conversion_experiments (name,type,hypothesis,control_variant,test_variant,metric,status,control_conversions,test_conversions,control_visitors,test_visitors,started_at) VALUES
        ('Homepage Hero CTA','A/B Test','A stronger action-oriented CTA will increase sign-up rate','Get Started Free','Start Your Growth Journey Today','signup_rate','running',142,189,1820,1745,NOW()-INTERVAL '14 days'),
        ('Pricing Page Layout','A/B Test','Showing annual savings prominently will increase annual plan selection','Standard pricing table','Annual savings highlighted prominently','annual_plan_rate','running',67,91,890,876,NOW()-INTERVAL '7 days'),
        ('Checkout Form Length','Multivariate','Reducing form fields will decrease abandonment rate','12-field checkout form','5-field streamlined checkout','checkout_completion','ended',234,312,1200,1190,NOW()-INTERVAL '30 days'),
        ('Free Trial vs Freemium','A/B Test','Freemium model will generate more qualified leads than time-limited trial','14-day free trial','Freemium with feature limits','qualified_leads','draft',0,0,0,0,NULL)`);
      await client.query(`INSERT INTO conversion_funnels (name,stages) VALUES
        ('Main Acquisition Funnel','[{"stage":"Awareness","visitors":15000,"conversions":4500,"rate":30},{"stage":"Interest","visitors":4500,"conversions":1800,"rate":40},{"stage":"Consideration","visitors":1800,"conversions":540,"rate":30},{"stage":"Intent","visitors":540,"conversions":189,"rate":35}]'),
        ('E-commerce Checkout Funnel','[{"stage":"Product View","visitors":8500,"conversions":3400,"rate":40},{"stage":"Add to Cart","visitors":3400,"conversions":1700,"rate":50},{"stage":"Checkout Start","visitors":1700,"conversions":850,"rate":50},{"stage":"Payment","visitors":850,"conversions":612,"rate":72}]')`);
      await client.query(`INSERT INTO conversion_offers (name,type,headline,cta,discount_pct,status,conversions) VALUES
        ('Black Friday Bundle','discount','Get 50% Off Everything This Weekend','Claim My 50% Off',50,'active',234),
        ('Free Consultation','lead_magnet','Book a Free 30-Min Strategy Session','Book My Free Session',0,'active',189),
        ('Starter Bundle','bundle','Everything You Need to Get Started — One Low Price','Get the Bundle',20,'active',145),
        ('Annual Plan Saver','subscription','Save 40% by Going Annual','Switch to Annual & Save',40,'active',98),
        ('Referral Bonus','referral','Give $50, Get $50 — Share with a Friend','Start Referring',0,'paused',67)`);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const experiments = await client.query('SELECT * FROM conversion_experiments ORDER BY created_at DESC');
    const metrics = await client.query(`SELECT
      COUNT(*) FILTER (WHERE status='running') AS running,
      COUNT(*) FILTER (WHERE status='ended') AS ended,
      COUNT(*) FILTER (WHERE status='draft') AS drafts,
      ROUND(AVG(CASE WHEN control_visitors>0 THEN (control_conversions::numeric/control_visitors)*100 END),2) AS avg_control_rate,
      ROUND(AVG(CASE WHEN test_visitors>0 THEN (test_conversions::numeric/test_visitors)*100 END),2) AS avg_test_rate
      FROM conversion_experiments`);
    return Response.json({ experiments: experiments.rows, metrics: metrics.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.name) return Response.json({ error: 'name required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO conversion_experiments (name,type,hypothesis,control_variant,test_variant,metric,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.name, b.type || 'A/B Test', b.hypothesis || null, b.control_variant || null, b.test_variant || null, b.metric || null, b.status || 'draft']
    );
    return Response.json({ experiment: rows[0] }, { status: 201 });
  } finally { client.release(); }
}

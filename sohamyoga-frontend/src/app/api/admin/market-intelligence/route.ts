export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS porter_analyses (
    id SERIAL PRIMARY KEY, industry TEXT, company_name TEXT,
    competitive_rivalry INTEGER DEFAULT 3, supplier_power INTEGER DEFAULT 3,
    buyer_power INTEGER DEFAULT 3, threat_new_entry INTEGER DEFAULT 3, threat_substitutes INTEGER DEFAULT 3,
    overall_score NUMERIC GENERATED ALWAYS AS ((competitive_rivalry+supplier_power+buyer_power+threat_new_entry+threat_substitutes)::NUMERIC/5) STORED,
    summary TEXT, recommendations TEXT[], created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS technology_scouts (
    id SERIAL PRIMARY KEY, technology_name TEXT, category TEXT, maturity_level TEXT DEFAULT 'emerging',
    vendor TEXT, use_case TEXT, relevance_score INTEGER DEFAULT 3, adoption_timeline TEXT,
    status TEXT DEFAULT 'monitoring', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS data_collection_jobs (
    id SERIAL PRIMARY KEY, name TEXT, source_type TEXT, source_url TEXT, schedule TEXT DEFAULT 'manual',
    last_run TIMESTAMPTZ, records_collected INTEGER DEFAULT 0, status TEXT DEFAULT 'idle',
    data_preview JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS web_scraping_configs (
    id SERIAL PRIMARY KEY, name TEXT, target_url TEXT, selectors JSONB, frequency TEXT DEFAULT 'daily',
    last_scraped TIMESTAMPTZ, data_points INTEGER DEFAULT 0, purpose TEXT, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM porter_analyses');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO porter_analyses (industry, company_name, competitive_rivalry, supplier_power, buyer_power, threat_new_entry, threat_substitutes, summary, recommendations) VALUES
      ('Online Fitness & Wellness','Sohamyoga',4,2,3,3,4,'Highly competitive market with low entry barriers. Strong competitive rivalry from apps and studios. Technology substitutes are a moderate threat.', ARRAY['Differentiate through community and personalization','Build strong brand loyalty program','Focus on niche specialization — yoga only']),
      ('Corporate Wellness Solutions','Sohamyoga Corp',3,2,4,3,2,'Corporate buyers have high power due to procurement processes. Competition is moderate. Barriers to entry are growing with compliance requirements.',ARRAY['Develop enterprise-grade SLAs','Create ROI calculators for procurement teams','Partner with HR platforms for distribution']),
      ('Digital Health Apps','MobileYoga',5,3,4,5,4,'Extremely competitive with Google and Apple entering the space. Very low entry barriers for new startups. Buyer power is high with free alternatives.',ARRAY['Focus on retention over acquisition','Build proprietary data moat','Consider platform integration partnerships'])
    `);
    await client.query(`INSERT INTO technology_scouts (technology_name, category, maturity_level, vendor, use_case, relevance_score, adoption_timeline, status, notes) VALUES
      ('AI Pose Detection','Computer Vision','growing','Google MediaPipe','Real-time yoga pose correction and feedback',5,'6-12 months','evaluating','High relevance for virtual instructor feature'),
      ('Wearable Heart Rate Integration','IoT','mature','Apple HealthKit / Garmin','Biometric-aware class intensity adjustment',4,'3-6 months','monitoring','Integration possible via Health APIs'),
      ('Personalization ML','Machine Learning','growing','TensorFlow Lite','On-device class recommendation engine',5,'12-18 months','evaluating','Could improve retention by 25%'),
      ('Voice-Controlled Navigation','NLP','early adopters','OpenAI Whisper','Hands-free app navigation during practice',3,'12-24 months','monitoring','Useful for in-class UX'),
      ('AR Overlay Instructions','Augmented Reality','emerging','ARCore / ARKit','Augmented reality pose guides overlaid on camera',4,'18-24 months','monitoring','Future differentiation opportunity'),
      ('Blockchain Loyalty Points','Blockchain','emerging','Polygon','Tokenized loyalty rewards for class completions',2,'24+ months','monitoring','Low priority — market not ready'),
      ('Generative AI Content','Generative AI','growing','Ollama / LLaMA','Auto-generate class descriptions and marketing copy',5,'0-3 months','active','Already in use — expand scope'),
      ('Predictive Churn Model','Machine Learning','mature','sklearn','Identify at-risk members before cancellation',4,'3-6 months','evaluating','Could reduce churn by 15%')
    `);
    await client.query(`INSERT INTO data_collection_jobs (name, source_type, source_url, schedule, records_collected, status) VALUES
      ('Competitor Price Tracker','web_scrape','https://competitors.com/pricing','weekly',342,'idle'),
      ('Google Trends - Yoga Keywords','api','https://trends.google.com','daily',8920,'idle'),
      ('Social Listening - Brand Mentions','social_api','twitter_api','hourly',15670,'idle')
    `);
    await client.query(`INSERT INTO web_scraping_configs (name, target_url, selectors, frequency, data_points, purpose, status) VALUES
      ('Mindbody Class Prices','https://mindbody.io','{".price": "text", ".class-name": "text"}','daily',847,'Competitor pricing intelligence','active'),
      ('Yoga Alliance Directory','https://www.yogaalliance.org','{".instructor-card": "html"}','weekly',12450,'Instructor network mapping','active'),
      ('G2 Reviews - Fitness Apps','https://www.g2.com/categories/fitness','{".review-text": "text", ".rating": "attr:data-score"}','daily',2340,'Sentiment competitive analysis','active'),
      ('LinkedIn Job Posts - Wellness','https://linkedin.com/jobs','{".job-title": "text", ".company": "text"}','daily',1205,'Market talent and growth signals','paused')
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
    const { rows } = await client.query('SELECT * FROM porter_analyses ORDER BY created_at DESC');
    return Response.json(rows);
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
      `INSERT INTO porter_analyses (industry, company_name, competitive_rivalry, supplier_power, buyer_power, threat_new_entry, threat_substitutes, summary, recommendations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.industry, body.company_name, body.competitive_rivalry || 3, body.supplier_power || 3,
       body.buyer_power || 3, body.threat_new_entry || 3, body.threat_substitutes || 3,
       body.summary, body.recommendations || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

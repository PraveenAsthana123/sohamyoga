export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS social_copy_requests (
      id SERIAL PRIMARY KEY,
      platform TEXT,
      tone TEXT,
      topic TEXT,
      target_audience TEXT,
      generated_copy TEXT,
      status TEXT DEFAULT 'draft',
      performance_score NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS community_members (
      id SERIAL PRIMARY KEY,
      platform TEXT,
      handle TEXT,
      engagement_level TEXT DEFAULT 'low',
      tags TEXT[],
      last_interaction TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS tiktok_ads (
      id SERIAL PRIMARY KEY,
      campaign_name TEXT,
      ad_format TEXT,
      budget NUMERIC DEFAULT 0,
      target_audience JSONB,
      hook TEXT,
      cta TEXT,
      status TEXT DEFAULT 'draft',
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS influencer_profiles (
      id SERIAL PRIMARY KEY,
      handle TEXT,
      platform TEXT,
      niche TEXT,
      followers INTEGER DEFAULT 0,
      engagement_rate NUMERIC DEFAULT 0,
      contact_email TEXT,
      status TEXT DEFAULT 'discovered',
      ai_match_score NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed data
  const { rows: existing } = await client.query('SELECT COUNT(*) FROM social_copy_requests');
  if (parseInt(existing[0].count) === 0) {
    await client.query(`
      INSERT INTO social_copy_requests (platform, tone, topic, target_audience, generated_copy, status, performance_score) VALUES
      ('twitter','professional','Yoga for beginners','Health enthusiasts','Start your yoga journey today! 🧘 5 beginner poses to transform your mornings. Thread below ↓','published',82),
      ('instagram','inspirational','Morning routines','Young professionals','Rise with intention. Your morning yoga practice sets the tone for everything. Swipe for our 10-minute sunrise flow. ✨ #morningyoga #wellness','published',91),
      ('linkedin','educational','Corporate wellness','HR professionals','Did you know companies with wellness programs see 28% lower sick days? Our corporate yoga packages bring mindfulness to your team.','published',74),
      ('instagram','casual','Meditation tips','Beginners','Meditation doesn''t have to be hard. Try our 2-minute breathing exercise that actually works 🌬️','draft',0),
      ('tiktok','energetic','Quick workout','Gen Z','POV: You tried yoga for 30 days and your back pain disappeared 😱 Here''s what happened...','draft',0),
      ('facebook','warm','Community event','Local community','Join us this Saturday for our free community yoga session in the park! All levels welcome 🌳','scheduled',67),
      ('twitter','witty','Wellness facts','General','Hot take: breathing correctly is a skill most adults forgot. Yoga fixes this. Here''s how 🧵','published',78),
      ('instagram','motivational','New year fitness','Goal setters','Your body is capable of amazing things. Let us help you discover them. New Year, New Practice.','draft',0)
    `);
    await client.query(`
      INSERT INTO community_members (platform, handle, engagement_level, tags, last_interaction, notes) VALUES
      ('instagram','@yogalife_sarah','high',ARRAY['yoga','wellness','influencer'],'2026-09-10','Top commenter, shares our posts'),
      ('facebook','wellness_mike','medium',ARRAY['beginner','corporate'],'2026-09-05','Attended last free session'),
      ('tiktok','@fitjourney_alex','high',ARRAY['fitness','yoga','tiktok-creator'],'2026-09-12','Creates UGC content'),
      ('instagram','@mindful.moments','low',ARRAY['meditation','mindfulness'],'2026-08-20','Needs re-engagement'),
      ('linkedin','Priya Wellness','medium',ARRAY['hr','corporate-wellness'],'2026-09-08','Interested in team packages')
    `);
    await client.query(`
      INSERT INTO tiktok_ads (campaign_name, ad_format, budget, target_audience, hook, cta, status, impressions, clicks) VALUES
      ('Beginner Yoga Sept','in-feed',500.00,'{"age":"18-35","interests":["fitness","wellness"]}','What if 10 minutes a day could change your life?','Start Free Trial',200000,8500),
      ('Corporate Wellness Q4','spark-ad',1200.00,'{"age":"25-45","job":"professional"}','Your team''s productivity boost is ONE class away','Book Demo',85000,3200),
      ('Holiday Gift Campaign','branded-hashtag',800.00,'{"age":"25-55","interest":"gifts"}','Give the gift of health this holiday season 🎁','Shop Now','draft',0,0)
    `);
    await client.query(`
      INSERT INTO influencer_profiles (handle, platform, niche, followers, engagement_rate, contact_email, status, ai_match_score) VALUES
      ('@sarahyogalife','instagram','yoga & wellness',125000,4.8,'sarah@yogalife.co','contacted',92),
      ('@fitnesswithpriya','instagram','fitness & nutrition',89000,6.2,'priya@fitpro.com','partner',88),
      ('@wellnesscoach_tom','youtube','holistic wellness',215000,3.1,'tom@wellcoach.com','discovered',79),
      ('@mindbodymike','tiktok','yoga & meditation',445000,7.5,'mike@mindbody.io','in-negotiation',95),
      ('@healthyhabits_jen','facebook','lifestyle & health',67000,4.2,'jen@healthy.co','discovered',71),
      ('@yogawithlily','instagram','beginner yoga',158000,5.9,'lily@yogastudio.com','partner',90)
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
    const [copies, stats] = await Promise.all([
      client.query('SELECT * FROM social_copy_requests ORDER BY created_at DESC LIMIT 50'),
      client.query('SELECT COUNT(*) as total, COALESCE(AVG(NULLIF(performance_score,0)),0) as avg_score FROM social_copy_requests'),
    ]);
    return Response.json({ copies: copies.rows, stats: stats.rows[0] });
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
      `INSERT INTO social_copy_requests (platform, tone, topic, target_audience, generated_copy, status)
       VALUES ($1,$2,$3,$4,$5,'draft') RETURNING *`,
      [body.platform, body.tone, body.topic, body.target_audience, body.generated_copy]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS repurpose_projects (
      id SERIAL PRIMARY KEY, title TEXT, source_type TEXT DEFAULT 'video',
      source_reference TEXT, source_duration_minutes NUMERIC DEFAULT 0,
      goals TEXT[], target_channels TEXT[], status TEXT DEFAULT 'planning',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS repurpose_assets (
      id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES repurpose_projects(id),
      asset_type TEXT, title TEXT, platform TEXT, format TEXT DEFAULT '16:9',
      duration_seconds INTEGER DEFAULT 0, content TEXT, status TEXT DEFAULT 'draft',
      approved_by TEXT, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS content_bundles (
      id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES repurpose_projects(id),
      bundle_name TEXT, assets_count INTEGER DEFAULT 0, channels TEXT[],
      status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows } = await client.query('SELECT COUNT(*) FROM repurpose_projects');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`
      INSERT INTO repurpose_projects (title, source_type, source_reference, source_duration_minutes, goals, target_channels, status) VALUES
      ('Autumn Wellness Webinar Repurposing', 'video', 'autumn_wellness_webinar.mp4', 90, ARRAY['brand awareness','lead generation','community growth'], ARRAY['Blog','Newsletter','LinkedIn','YouTube Short'], 'active'),
      ('Product Launch Video — Premium Membership', 'video', 'premium_launch_2026.mp4', 12, ARRAY['conversion','product awareness'], ARRAY['Twitter','Instagram','TikTok','LinkedIn'], 'active'),
      ('Beginner Yoga Tutorial Series', 'recording', 'beginner_yoga_ep1.mp4', 45, ARRAY['education','SEO','subscriber growth'], ARRAY['Blog','YouTube Short','Instagram','Newsletter'], 'completed')
    `);
    const { rows: projects } = await client.query('SELECT id FROM repurpose_projects ORDER BY id');
    // Seed assets for project 1
    await client.query(`
      INSERT INTO repurpose_assets (project_id, asset_type, title, platform, format, content, status) VALUES
      ($1,'article','5 Mindfulness Practices from Our Autumn Webinar','Blog','long-form','This autumn, our wellness community gathered for an immersive 90-minute webinar on mindfulness and holistic health. Here are the five most impactful practices shared by our expert instructors...','approved'),
      ($1,'newsletter','Autumn Wellness Recap: Key Insights & Your Next Steps','Newsletter','email','Dear Wellness Community,\n\nThank you for joining us at the Autumn Wellness Webinar. We covered 5 transformative practices you can begin today. Here are your top takeaways...','draft'),
      ($1,'post','The one mindfulness tip from our webinar that changed everything for 500+ participants','LinkedIn','text','Last week we hosted our most attended webinar yet. The moment that got the biggest response? A simple 4-7-8 breathing technique that our instructor demonstrated live. Here is why it works...','approved'),
      ($1,'short','60-second highlight: Breathwork demo from Autumn Webinar','YouTube Short','9:16','[Hook: Watch this breathe technique reduce stress in real-time]\n\nIn our webinar, 500+ participants learned this 4-7-8 breathing method. Try it now:\n1. Inhale 4 counts\n2. Hold 7 counts\n3. Exhale 8 counts\nRepeat 4 times. Tag someone who needs this.','draft')
    `, [projects[0].id]);
    // Seed assets for project 2
    await client.query(`
      INSERT INTO repurpose_assets (project_id, asset_type, title, platform, format, content, status) VALUES
      ($1,'tweet','🚀 Big announcement: Premium Membership is LIVE','Twitter','text','🚀 Big announcement: Our Premium Membership is now LIVE!\n\n✅ Unlimited classes\n✅ 1-on-1 instructor sessions\n✅ Exclusive content library\n✅ Community access\n\nLink in bio → First 100 members get 20% off. 🧘','approved'),
      ($1,'reel','Premium membership — what you get (30-sec reel)','Instagram','9:16','[REEL SCRIPT]\n\nScene 1: Show premium class library\nCaption: Unlimited classes\nScene 2: 1-on-1 call footage\nCaption: Personal instructor\nScene 3: Community board\nCaption: Private community\nCTA: Link in bio for founding member pricing','draft'),
      ($1,'tiktok','POV: You just got Premium access','TikTok','9:16','[TikTok Script]\nSound: trending audio\nText overlay: POV: You just unlocked Premium\n→ 500+ classes\n→ Live sessions daily\n→ Your personal instructor\n→ Community challenges\nCTA: Grab founding member pricing (link in bio)','draft')
    `, [projects[1].id]);
    // Seed assets for project 3
    await client.query(`
      INSERT INTO repurpose_assets (project_id, asset_type, title, platform, format, content, status) VALUES
      ($1,'article','Beginner Yoga: Everything You Need to Know Before Your First Class','Blog','long-form','Starting yoga can feel intimidating. In this guide, we break down everything from what to wear to which poses to start with, based on our expert instructors beginner tutorial series...','approved'),
      ($1,'newsletter','Your beginner yoga starter pack — free resources inside','Newsletter','email','Hi there,\n\nIf you have been thinking about starting yoga but are not sure where to begin, we made this just for you. Our Beginner Tutorial Series breaks it all down step by step...','approved'),
      ($1,'short','Downward dog in 60 seconds — beginner friendly','YouTube Short','9:16','[Script]\nHook: Struggling with downward dog? Watch this.\nStep 1: Start in table-top\nStep 2: Tuck toes, lift hips\nStep 3: Press heels toward floor\nStep 4: Relax your neck\nDo this daily for 7 days. Follow for more beginner tips.','approved')
    `, [projects[2].id]);
    // Create a bundle for project 3 (completed)
    await client.query(`
      INSERT INTO content_bundles (project_id, bundle_name, assets_count, channels, status) VALUES
      ($1, 'Beginner Yoga Launch Bundle', 3, ARRAY['Blog','Newsletter','YouTube Short'], 'ready')
    `, [projects[2].id]);
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
    const { rows: projects } = await client.query(`
      SELECT p.*, COUNT(a.id)::int AS asset_count,
             COUNT(a.id) FILTER (WHERE a.status='approved')::int AS approved_count
      FROM repurpose_projects p
      LEFT JOIN repurpose_assets a ON a.project_id = p.id
      GROUP BY p.id ORDER BY p.created_at DESC
    `);
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(DISTINCT p.id) AS total_projects,
        COUNT(a.id) AS total_assets,
        COUNT(a.id) FILTER (WHERE a.created_at >= NOW() - INTERVAL '7 days') AS assets_this_week,
        COUNT(a.id) FILTER (WHERE a.status='approved') AS approved_assets,
        array_agg(DISTINCT unnest) FILTER (WHERE unnest IS NOT NULL) AS all_channels
      FROM repurpose_projects p
      LEFT JOIN repurpose_assets a ON a.project_id = p.id
      CROSS JOIN LATERAL unnest(p.target_channels) AS unnest
    `);
    return Response.json({ projects, stats: stats[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { title, source_type = 'video', source_reference, source_duration_minutes = 0, goals = [], target_channels = [] } = body;
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(`
      INSERT INTO repurpose_projects (title, source_type, source_reference, source_duration_minutes, goals, target_channels)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [title, source_type, source_reference || null, source_duration_minutes, goals, target_channels]);
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}

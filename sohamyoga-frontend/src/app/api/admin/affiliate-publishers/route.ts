import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS affiliate_publishers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT,
      contact_name TEXT NOT NULL,
      contact_email TEXT,
      contact_phone TEXT,
      website_url TEXT,
      social_profiles JSONB DEFAULT '{}',
      publisher_type TEXT DEFAULT 'blogger',
      niche TEXT[],
      audience_size INT,
      monthly_traffic INT,
      geo_focus TEXT[],
      proposed_commission_pct NUMERIC(5,2),
      status TEXT DEFAULT 'prospect',
      tier TEXT,
      performance_score INT DEFAULT 0,
      notes TEXT,
      recruited_by TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS publisher_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      publisher_id UUID REFERENCES affiliate_publishers(id),
      application_text TEXT,
      portfolio_url TEXT,
      monthly_traffic_claimed INT,
      audience_description TEXT,
      promotion_plan TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedIfEmpty(pool: ReturnType<typeof getPool>) {
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM affiliate_publishers');
  if (parseInt(rows[0].cnt) > 0) return;

  const publishers = [
    { company_name: 'Wellness Weekly Blog', contact_name: 'Priya Sharma', contact_email: 'priya@wellnessweekly.com', website_url: 'https://wellnessweekly.com', publisher_type: 'blogger', niche: ['wellness', 'yoga', 'mindfulness'], audience_size: 45000, monthly_traffic: 80000, geo_focus: ['IN', 'US'], proposed_commission_pct: 12.00, status: 'active', tier: 'silver', performance_score: 78, social_profiles: { instagram: '@wellnessweekly', youtube: 'WellnessWeekly' } },
    { company_name: 'FitLife Influencer', contact_name: 'Carlos Mendez', contact_email: 'carlos@fitlife.io', website_url: 'https://instagram.com/fitlifecm', publisher_type: 'influencer', niche: ['fitness', 'yoga', 'health'], audience_size: 250000, monthly_traffic: 120000, geo_focus: ['US', 'CA', 'GB'], proposed_commission_pct: 15.00, status: 'approved', tier: 'gold', performance_score: 85, social_profiles: { instagram: '@fitlifecm', tiktok: '@fitlifecm' } },
    { company_name: 'Deal Hunter Cashback', contact_name: 'Aisha Okonkwo', contact_email: 'aisha@dealhunter.net', website_url: 'https://dealhunter.net', publisher_type: 'cashback', niche: ['deals', 'lifestyle', 'wellness'], audience_size: 1500000, monthly_traffic: 3000000, geo_focus: ['US', 'CA'], proposed_commission_pct: 8.00, status: 'active', tier: 'platinum', performance_score: 92, social_profiles: {} },
    { company_name: 'Mind Body Spirit Podcast', contact_name: 'James Wu', contact_email: 'james@mbspodcast.com', website_url: 'https://mbspodcast.com', publisher_type: 'podcast', niche: ['mindfulness', 'yoga', 'spirituality'], audience_size: 75000, monthly_traffic: 30000, geo_focus: ['US', 'AU', 'NZ'], proposed_commission_pct: 10.00, status: 'contacted', tier: 'silver', performance_score: 0, social_profiles: { instagram: '@mbspodcast' } },
    { company_name: 'Yoga Comparison Hub', contact_name: 'Sarah Klein', contact_email: 'sarah@yogacomparehub.com', website_url: 'https://yogacomparehub.com', publisher_type: 'comparison_site', niche: ['yoga', 'wellness'], audience_size: 200000, monthly_traffic: 500000, geo_focus: ['US', 'GB', 'AU'], proposed_commission_pct: 11.00, status: 'application_sent', tier: null, performance_score: 0, social_profiles: {} },
    { company_name: 'Healthy Living Newsletter', contact_name: 'David Nguyen', contact_email: 'david@hlnewsletter.com', website_url: 'https://hlnewsletter.com', publisher_type: 'email_list', niche: ['health', 'wellness', 'nutrition'], audience_size: 90000, monthly_traffic: 15000, geo_focus: ['US'], proposed_commission_pct: 13.00, status: 'prospect', tier: null, performance_score: 0, social_profiles: {} },
    { company_name: 'Zen Life Media', contact_name: 'Emma Patel', contact_email: 'emma@zenlifemedia.com', website_url: 'https://zenlifemedia.com', publisher_type: 'social_media', niche: ['yoga', 'meditation', 'wellness'], audience_size: 350000, monthly_traffic: 200000, geo_focus: ['IN', 'US', 'SG'], proposed_commission_pct: 14.00, status: 'active', tier: 'gold', performance_score: 88, social_profiles: { instagram: '@zenlifemedia', youtube: 'ZenLifeMedia' } },
    { company_name: 'Wellness News Today', contact_name: 'Mark Thompson', contact_email: 'mark@wellnessnews.today', website_url: 'https://wellnessnews.today', publisher_type: 'news_site', niche: ['wellness', 'health', 'fitness'], audience_size: 2000000, monthly_traffic: 5000000, geo_focus: ['US', 'GB'], proposed_commission_pct: 7.00, status: 'prospect', tier: null, performance_score: 0, social_profiles: {} },
    { company_name: 'Om & Flow Blog', contact_name: 'Rina Tanaka', contact_email: 'rina@omflow.blog', website_url: 'https://omflow.blog', publisher_type: 'blogger', niche: ['yoga', 'ayurveda', 'wellness'], audience_size: 8000, monthly_traffic: 12000, geo_focus: ['IN', 'JP'], proposed_commission_pct: 10.00, status: 'prospect', tier: null, performance_score: 0, social_profiles: { instagram: '@omflowblog' } },
    { company_name: 'ShareASale Top Publisher', contact_name: 'Alex Johnson', contact_email: 'alex@topaffiliate.com', website_url: 'https://topaffiliate.com', publisher_type: 'comparison_site', niche: ['wellness', 'lifestyle', 'yoga'], audience_size: 500000, monthly_traffic: 1200000, geo_focus: ['US', 'CA', 'AU'], proposed_commission_pct: 12.00, status: 'paused', tier: 'gold', performance_score: 65, social_profiles: {} },
  ];

  const insertedIds: string[] = [];
  for (const p of publishers) {
    const { rows } = await pool.query(`
      INSERT INTO affiliate_publishers (company_name, contact_name, contact_email, website_url, publisher_type, niche, audience_size, monthly_traffic, geo_focus, proposed_commission_pct, status, tier, performance_score, social_profiles)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id
    `, [p.company_name, p.contact_name, p.contact_email, p.website_url, p.publisher_type, p.niche, p.audience_size, p.monthly_traffic, p.geo_focus, p.proposed_commission_pct, p.status, p.tier, p.performance_score, JSON.stringify(p.social_profiles)]);
    if (p.status === 'approved' || p.status === 'active') {
      await pool.query(`UPDATE affiliate_publishers SET approved_at=NOW()-INTERVAL '${Math.floor(Math.random()*60)+1} days' WHERE id=$1`, [rows[0].id]);
    }
    insertedIds.push(rows[0].id);
  }

  // Seed applications
  const appData = [
    { idx: 1, text: 'I run a fitness Instagram with 250k followers and would love to promote Soham Yoga to my audience.', traffic: 120000, desc: 'Health-conscious millennials aged 25-35 in North America', plan: 'Instagram posts, stories, and reels showcasing yoga sessions', status: 'approved' },
    { idx: 4, text: 'Our podcast reaches 75k weekly listeners interested in mindfulness and spirituality.', traffic: 30000, desc: 'Spiritually-inclined adults aged 30-50', plan: 'Dedicated podcast episode + host-read ads', status: 'pending' },
    { idx: 5, text: 'We run a comparison site for yoga studios and would list Soham Yoga as a featured partner.', traffic: 500000, desc: 'Yoga practitioners searching for classes and studios', plan: 'Featured placement on comparison pages + dedicated review post', status: 'pending' },
    { idx: 6, text: 'Our newsletter reaches 90k health-conscious subscribers weekly.', traffic: 15000, desc: 'Health-focused professionals aged 28-45', plan: 'Dedicated email blast + monthly mention in newsletter', status: 'more_info_needed' },
    { idx: 2, text: 'One of the largest cashback platforms with 1.5M members.', traffic: 3000000, desc: 'Bargain-seeking consumers across all demographics', plan: 'Cashback offers, coupon promotions, featured deals section', status: 'approved' },
  ];

  for (const app of appData) {
    await pool.query(`
      INSERT INTO publisher_applications (publisher_id, application_text, monthly_traffic_claimed, audience_description, promotion_plan, status, reviewed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      insertedIds[app.idx],
      app.text,
      app.traffic,
      app.desc,
      app.plan,
      app.status,
      app.status !== 'pending' ? new Date(Date.now() - Math.random() * 14 * 86400000).toISOString() : null,
    ]);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    await ensureSchema(pool);
    await seedIfEmpty(pool);
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const tier = url.searchParams.get('tier');
    const status = url.searchParams.get('status');

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (type) { values.push(type); conditions.push(`publisher_type=$${values.length}`); }
    if (tier) { values.push(tier); conditions.push(`tier=$${values.length}`); }
    if (status) { values.push(status); conditions.push(`status=$${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [publishers, pipelineStats] = await Promise.all([
      pool.query(`SELECT * FROM affiliate_publishers ${where} ORDER BY created_at DESC`, values),
      pool.query(`
        SELECT status, COUNT(*) AS count FROM affiliate_publishers GROUP BY status
        UNION ALL
        SELECT 'total' AS status, COUNT(*) AS count FROM affiliate_publishers
      `),
    ]);

    const statsMap: Record<string, number> = {};
    for (const row of pipelineStats.rows) statsMap[row.status] = parseInt(row.count);

    return Response.json({ publishers: publishers.rows, pipelineStats: statsMap });
  } catch (err) {
    console.error('affiliate-publishers GET error:', err);
    return Response.json({ error: 'Failed to load publishers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    await ensureSchema(pool);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { contact_name, company_name, contact_email, contact_phone, website_url, social_profiles, publisher_type, niche, audience_size, monthly_traffic, geo_focus, proposed_commission_pct, notes, recruited_by } = body as Record<string, unknown>;
    if (!contact_name || typeof contact_name !== 'string' || !contact_name.trim()) {
      return Response.json({ error: 'contact_name is required' }, { status: 400 });
    }
    const validTypes = ['blogger', 'influencer', 'comparison_site', 'cashback', 'email_list', 'social_media', 'podcast', 'news_site'];
    const ptype = typeof publisher_type === 'string' && validTypes.includes(publisher_type) ? publisher_type : 'blogger';
    const { rows } = await pool.query(`
      INSERT INTO affiliate_publishers (contact_name, company_name, contact_email, contact_phone, website_url, social_profiles, publisher_type, niche, audience_size, monthly_traffic, geo_focus, proposed_commission_pct, notes, recruited_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
    `, [
      contact_name.trim(),
      typeof company_name === 'string' ? company_name.trim() : null,
      typeof contact_email === 'string' ? contact_email.trim() : null,
      typeof contact_phone === 'string' ? contact_phone.trim() : null,
      typeof website_url === 'string' ? website_url.trim() : null,
      social_profiles ? JSON.stringify(social_profiles) : '{}',
      ptype,
      Array.isArray(niche) ? niche : [],
      typeof audience_size === 'number' ? audience_size : null,
      typeof monthly_traffic === 'number' ? monthly_traffic : null,
      Array.isArray(geo_focus) ? geo_focus : [],
      typeof proposed_commission_pct === 'number' ? proposed_commission_pct : null,
      typeof notes === 'string' ? notes.trim() : null,
      typeof recruited_by === 'string' ? recruited_by.trim() : null,
    ]);
    return Response.json({ publisher: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('affiliate-publishers POST error:', err);
    return Response.json({ error: 'Failed to create publisher' }, { status: 500 });
  }
}

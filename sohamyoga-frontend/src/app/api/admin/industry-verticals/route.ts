export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

const SEED_VERTICALS = [
  {
    slug: 'dental',
    name: 'Dental & Orthodontic Clinics',
    icon: '🦷',
    description: 'Full-funnel marketing for dental and orthodontic practices — from new patient acquisition to cosmetic upsells and membership plan retention.',
    target_audience: 'Families, adults 25-55, high-income households, cosmetic dental seekers',
    revenue_models: ['Treatment plans', 'Membership plans', 'Cosmetic packages', 'Insurance billing', 'Referral rewards'],
    key_channels: ['Google Local', 'Instagram', 'Facebook', 'Email', 'SMS reminders'],
    avg_deal_size: 1800,
    typical_pain_points: ['High no-show rates', 'Insurance complexity', 'Patient retention after treatment', 'Negative reviews from anxious patients', 'Low cosmetic conversion'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'New Patient Acquisition', campaign_type: 'paid_search', target_segment: 'Local adults 25-55 searching for dentist', budget_estimate: 2000, expected_roas: 4.5, channels: ['Google Ads', 'Google Local'], status: 'template' },
      { campaign_name: 'Recall Campaign', campaign_type: 'email_sms', target_segment: 'Existing patients overdue for checkup', budget_estimate: 300, expected_roas: 12.0, channels: ['Email', 'SMS'], status: 'template' },
      { campaign_name: 'Cosmetic Upsell', campaign_type: 'social', target_segment: 'Adults 28-50 interested in smile improvement', budget_estimate: 1200, expected_roas: 3.8, channels: ['Instagram', 'Facebook'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'pain_point', hook_text: 'Nervous about the dentist? Our anxiety-free approach has helped 2,000+ patients finally get the smile they deserve.', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'social_proof', hook_text: '⭐⭐⭐⭐⭐ "Best dental experience I\'ve ever had — they explained everything." — Sarah M.', platform: 'Facebook', performance_score: 5 },
      { hook_type: 'offer', hook_text: 'New patients: complete exam + X-rays + cleaning for $99. Limited spots this month.', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'educational', hook_text: '3 signs your teeth whitening products are actually damaging your enamel (swipe to see the safe alternatives)', platform: 'Instagram', performance_score: 3 },
      { hook_type: 'urgency', hook_text: 'Your dental benefits reset January 1. Don\'t leave money on the table — book before Dec 31.', platform: 'Email', performance_score: 5 },
    ],
  },
  {
    slug: 'school',
    name: 'Schools & EdTech Platforms',
    icon: '🎓',
    description: 'Enrollment and retention marketing for private schools, tutoring centers, online learning platforms, and corporate L&D providers.',
    target_audience: 'Parents, K-12 students, corporate L&D buyers, adult learners seeking certifications',
    revenue_models: ['Tuition fees', 'Online course sales', 'Certification programs', 'B2B training contracts', 'Subscription memberships'],
    key_channels: ['Google Ads', 'YouTube', 'LinkedIn', 'Email', 'Facebook groups'],
    avg_deal_size: 3500,
    typical_pain_points: ['Enrollment seasonality (Sept/Jan spikes)', 'Low online visibility', 'Retention after initial enrollment', 'Parent trust and social proof', 'Competing on price with free content'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'Enrollment Drive', campaign_type: 'paid_search', target_segment: 'Parents of school-age children in target zip codes', budget_estimate: 3000, expected_roas: 5.2, channels: ['Google Ads', 'Facebook'], status: 'template' },
      { campaign_name: 'Course Launch', campaign_type: 'email_social', target_segment: 'Email list + lookalike of past students', budget_estimate: 800, expected_roas: 8.0, channels: ['Email', 'YouTube', 'Instagram'], status: 'template' },
      { campaign_name: 'Alumni Re-engagement', campaign_type: 'email', target_segment: 'Past students not enrolled in 12+ months', budget_estimate: 200, expected_roas: 15.0, channels: ['Email', 'SMS'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'outcome', hook_text: 'Our students score 23% above the national average. Here\'s the curriculum approach that makes the difference.', platform: 'Facebook', performance_score: 4 },
      { hook_type: 'parent_trust', hook_text: 'What every parent wishes they knew before choosing a school — a checklist from 20+ years in education.', platform: 'Facebook', performance_score: 5 },
      { hook_type: 'offer', hook_text: 'Enroll before March 31 and lock in last year\'s tuition rates. Only 12 spots remaining.', platform: 'Email', performance_score: 5 },
      { hook_type: 'educational', hook_text: 'The real reason kids fall behind in math (hint: it\'s not their fault) — and what actually helps.', platform: 'YouTube', performance_score: 4 },
      { hook_type: 'social_proof', hook_text: '"My daughter went from failing grades to a full scholarship. This school changed her life." — James T., parent', platform: 'Instagram', performance_score: 5 },
    ],
  },
  {
    slug: 'real-estate',
    name: 'Real Estate & Property',
    icon: '🏠',
    description: 'Lead generation and nurture marketing for real estate agents, brokerages, property developers, and property management companies.',
    target_audience: 'Home buyers, sellers, real estate investors, renters, property developers',
    revenue_models: ['Agent commissions', 'Property management fees', 'Referral fees', 'Developer sales commissions', 'Rental management'],
    key_channels: ['Google Ads', 'Instagram', 'Facebook Marketplace', 'YouTube virtual tours', 'Email nurture'],
    avg_deal_size: 12000,
    typical_pain_points: ['Long sales cycles (3-6 months)', 'Lead quality vs volume', 'Offline-to-online conversion', 'Commission compression', 'Differentiating from Zillow/Redfin'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'Property Launch', campaign_type: 'social_video', target_segment: 'Buyers in target neighbourhood income bracket', budget_estimate: 2500, expected_roas: 6.0, channels: ['Instagram', 'Facebook', 'YouTube'], status: 'template' },
      { campaign_name: 'Buyer Lead Gen', campaign_type: 'paid_search', target_segment: 'People actively searching to buy in target metro', budget_estimate: 4000, expected_roas: 4.0, channels: ['Google Ads', 'Facebook'], status: 'template' },
      { campaign_name: 'Investor Outreach', campaign_type: 'linkedin_email', target_segment: 'HNI investors, property portfolio holders', budget_estimate: 1500, expected_roas: 9.0, channels: ['LinkedIn', 'Email'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'market_insight', hook_text: '3 neighbourhoods where property values are quietly rising — most buyers are missing them entirely.', platform: 'Instagram', performance_score: 5 },
      { hook_type: 'social_proof', hook_text: 'We sold this home in 11 days, $42k above asking price. Here\'s the exact strategy we used.', platform: 'Facebook', performance_score: 5 },
      { hook_type: 'educational', hook_text: 'The hidden costs of buying a home that no one talks about until closing day (save this).', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'pain_point', hook_text: 'Tired of losing bidding wars? Our buyers win 80% of the time. Here\'s what we do differently.', platform: 'Facebook', performance_score: 4 },
      { hook_type: 'offer', hook_text: 'Free home valuation — find out what your property is worth in today\'s market. Takes 2 minutes.', platform: 'Facebook', performance_score: 5 },
    ],
  },
  {
    slug: 'qsr',
    name: 'Quick Service Restaurants & Food',
    icon: '🍕',
    description: 'Local marketing, loyalty, and delivery optimization for QSR chains, fast-casual restaurants, food trucks, and cloud kitchens.',
    target_audience: 'Local customers, delivery-app users, office lunch groups, families, weekend diners',
    revenue_models: ['Dine-in revenue', 'Takeout orders', 'Delivery revenue', 'Catering contracts', 'Loyalty program spend'],
    key_channels: ['Google My Business', 'Instagram', 'TikTok', 'Delivery apps', 'SMS loyalty'],
    avg_deal_size: 45,
    typical_pain_points: ['High delivery platform commissions', 'Online review management', 'Low repeat visit frequency', 'Slow periods between lunch and dinner', 'New location awareness'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'New Location Launch', campaign_type: 'local_social', target_segment: 'Residents within 3km of new location', budget_estimate: 1500, expected_roas: 5.5, channels: ['Google My Business', 'Instagram', 'Facebook'], status: 'template' },
      { campaign_name: 'Loyalty Drive', campaign_type: 'sms_email', target_segment: 'Past customers with 1+ visit in last 90 days', budget_estimate: 400, expected_roas: 18.0, channels: ['SMS', 'Email'], status: 'template' },
      { campaign_name: 'Seasonal Promotion', campaign_type: 'social_video', target_segment: 'Broad local audience 18-50', budget_estimate: 800, expected_roas: 7.0, channels: ['TikTok', 'Instagram', 'SMS'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'craving', hook_text: 'That moment when the cheese pull is just *chef\'s kiss* 🧀 (we dare you not to order right now)', platform: 'TikTok', performance_score: 5 },
      { hook_type: 'offer', hook_text: 'BOGO Tuesdays are back 🔥 Buy one, get one free — dine-in only. Tag someone you\'re bringing.', platform: 'Instagram', performance_score: 5 },
      { hook_type: 'behind_scenes', hook_text: 'We make our sauce fresh every morning. No shortcuts. Watch how it\'s done. 👩‍🍳', platform: 'TikTok', performance_score: 4 },
      { hook_type: 'social_proof', hook_text: '500+ five-star reviews can\'t be wrong. Come find out why we\'re the most loved spot in [City].', platform: 'Facebook', performance_score: 4 },
      { hook_type: 'loyalty', hook_text: 'Your 5th visit is on us. Download our app and every order earns you free food. 🍕', platform: 'Instagram', performance_score: 4 },
    ],
  },
  {
    slug: 'beauty',
    name: 'Beauty, Salon & Wellness Studios',
    icon: '💄',
    description: 'Booking-driven marketing for hair salons, beauty clinics, nail studios, spas, and wellness centers — reducing no-shows and maximizing chair/room utilization.',
    target_audience: 'Women 18-45, brides-to-be, working professionals, self-care enthusiasts',
    revenue_models: ['Service bookings', 'Retail product sales', 'Membership packages', 'Gift cards', 'Bridal packages'],
    key_channels: ['Instagram', 'TikTok', 'Google', 'Pinterest', 'WhatsApp bookings'],
    avg_deal_size: 180,
    typical_pain_points: ['No-show and late cancellation rates', 'Seasonal demand spikes (prom, weddings, holidays)', 'Low staff utilization in slow periods', 'Price sensitivity vs premium positioning', 'Retaining stylists with strong client books'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'New Client Acquisition', campaign_type: 'social_ads', target_segment: 'Women 18-45 within 10km interested in beauty/wellness', budget_estimate: 1000, expected_roas: 4.2, channels: ['Instagram', 'TikTok', 'Google'], status: 'template' },
      { campaign_name: 'Bridal Package', campaign_type: 'paid_social', target_segment: 'Engaged women, bridal party searches', budget_estimate: 800, expected_roas: 6.5, channels: ['Instagram', 'Pinterest', 'Google'], status: 'template' },
      { campaign_name: 'Retail Product Push', campaign_type: 'email_social', target_segment: 'Existing clients + email list', budget_estimate: 300, expected_roas: 9.0, channels: ['Email', 'Instagram', 'WhatsApp'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'transformation', hook_text: 'Before → After: 3 hours, one appointment, and a whole new level of confidence. ✨ (transformation video)', platform: 'TikTok', performance_score: 5 },
      { hook_type: 'social_proof', hook_text: 'She walked in nervous. She walked out unstoppable. 💖 Real client, real results.', platform: 'Instagram', performance_score: 5 },
      { hook_type: 'educational', hook_text: 'The 3 things your stylist wishes you\'d stop doing to your hair between appointments.', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'offer', hook_text: 'First visit? Get 20% off your first service. Use code GLOW when booking online.', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'bridal', hook_text: 'Bride-to-be? Book your bridal trial 6+ months out and get the group discount on your whole party. 💍', platform: 'Pinterest', performance_score: 4 },
    ],
  },
  {
    slug: 'online-teaching',
    name: 'Online Coaches & Course Creators',
    icon: '📱',
    description: 'Launch, grow, and retain audiences for online coaches, course creators, membership site operators, and digital educators in any niche.',
    target_audience: 'Skill-builders, career changers, hobbyists, professionals seeking advancement, entrepreneurs',
    revenue_models: ['One-time course sales', 'Membership/subscription', '1-on-1 coaching packages', 'Mastermind programs', 'Done-for-you services'],
    key_channels: ['YouTube', 'Instagram', 'Email', 'Facebook groups', 'Webinars'],
    avg_deal_size: 950,
    typical_pain_points: ['Content saturation and discoverability', 'Low course completion rates hurting reviews', 'Launch fatigue and revenue seasonality', 'Building audience trust before selling', 'Tech complexity and platform fragmentation'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'Course Launch', campaign_type: 'email_webinar', target_segment: 'Warm email list + engaged social followers', budget_estimate: 1500, expected_roas: 10.0, channels: ['Email', 'Instagram', 'YouTube', 'Webinar'], status: 'template' },
      { campaign_name: 'Free Webinar Funnel', campaign_type: 'paid_social', target_segment: 'Cold audience matching past student demographics', budget_estimate: 2000, expected_roas: 5.0, channels: ['Facebook Ads', 'Instagram Ads', 'YouTube Ads'], status: 'template' },
      { campaign_name: 'Community Membership', campaign_type: 'content_social', target_segment: 'Existing students + YouTube subscribers', budget_estimate: 600, expected_roas: 8.0, channels: ['Email', 'YouTube', 'Facebook Group'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'credibility', hook_text: 'I went from $0 to $120k/year teaching exactly what I already knew. Here\'s the framework I used.', platform: 'YouTube', performance_score: 5 },
      { hook_type: 'contrarian', hook_text: 'You don\'t need a massive audience to make great money with an online course. You need this instead.', platform: 'Instagram', performance_score: 5 },
      { hook_type: 'pain_point', hook_text: 'If your course isn\'t selling, it\'s probably not the course — it\'s one of these 3 positioning mistakes.', platform: 'Email', performance_score: 4 },
      { hook_type: 'outcome', hook_text: '237 students. 89% completion rate. $340k in 14 months. Real numbers from a real course creator.', platform: 'Facebook', performance_score: 4 },
      { hook_type: 'invitation', hook_text: 'Free live training Thursday: how I plan a $10k course launch in 7 days. Grab your spot before it fills.', platform: 'Instagram', performance_score: 5 },
    ],
  },
  {
    slug: 'astrology',
    name: 'Astrology, Spiritual & Metaphysical Services',
    icon: '✨',
    description: 'Audience-building and monetization marketing for astrologers, tarot readers, spiritual coaches, and metaphysical product sellers.',
    target_audience: 'Women 25-45, wellness and spirituality seekers, new age community members, subscription content fans',
    revenue_models: ['Personal readings', 'Monthly subscriptions', 'Spiritual courses', 'Merchandise and crystals', 'In-person and virtual events'],
    key_channels: ['Instagram', 'TikTok', 'YouTube', 'Email', 'Etsy', 'Pinterest'],
    avg_deal_size: 120,
    typical_pain_points: ['Seasonal demand spikes (Mercury retrograde, eclipses)', 'Platform ad restrictions on spiritual/psychic services', 'Building repeat business beyond one-time readings', 'Trust and credibility in a sceptic-friendly market', 'Payment processor limitations for metaphysical services'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'Monthly Reading Promotion', campaign_type: 'organic_social', target_segment: 'Followers + email list aligned with lunar calendar', budget_estimate: 200, expected_roas: 14.0, channels: ['Instagram', 'Email', 'TikTok'], status: 'template' },
      { campaign_name: 'Course Launch', campaign_type: 'email_social', target_segment: 'Engaged followers interested in learning astrology', budget_estimate: 800, expected_roas: 8.5, channels: ['Email', 'Instagram', 'YouTube'], status: 'template' },
      { campaign_name: 'Subscription Growth', campaign_type: 'content_sms', target_segment: 'Past clients + warm social audience', budget_estimate: 400, expected_roas: 11.0, channels: ['Email', 'Instagram', 'Patreon'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'cosmic_event', hook_text: 'Mercury retrograde hits March 3rd. Here\'s your survival guide for every sign. 🌑', platform: 'Instagram', performance_score: 5 },
      { hook_type: 'personalization', hook_text: 'Your birth chart holds the answer to why that pattern keeps repeating in your relationships.', platform: 'TikTok', performance_score: 5 },
      { hook_type: 'educational', hook_text: 'What your moon sign says about how you handle stress (most people only know their sun sign 🌙)', platform: 'Instagram', performance_score: 4 },
      { hook_type: 'community', hook_text: 'Aries season is HERE. Drop your rising sign below and I\'ll tell you what this month holds for you 🔥', platform: 'TikTok', performance_score: 5 },
      { hook_type: 'offer', hook_text: 'New moon = new you. Book your clarity reading before the new moon in Scorpio — spots close Friday.', platform: 'Email', performance_score: 4 },
    ],
  },
  {
    slug: 'saas',
    name: 'SaaS & Software Businesses',
    icon: '💻',
    description: 'Acquisition, activation, retention, and expansion marketing for B2B and B2C SaaS companies — from early-stage to scaling growth teams.',
    target_audience: 'SMB owners, operations managers, developers, IT decision-makers, enterprise procurement',
    revenue_models: ['Monthly subscriptions (MRR)', 'Annual contracts (ARR)', 'Usage-based billing', 'Enterprise licenses', 'Professional services/onboarding'],
    key_channels: ['Google Ads', 'LinkedIn', 'G2/Capterra', 'Content/SEO', 'Email nurture'],
    avg_deal_size: 4200,
    typical_pain_points: ['High customer acquisition cost (CAC)', 'Long B2B sales cycles', 'Churn from low product adoption', 'Freemium-to-paid conversion', 'Competing with established players on review sites'],
    ai_playbook: '',
    status: 'active',
    campaigns: [
      { campaign_name: 'Free Trial Acquisition', campaign_type: 'paid_search_social', target_segment: 'Buyers actively searching for software category keywords', budget_estimate: 5000, expected_roas: 3.5, channels: ['Google Ads', 'LinkedIn', 'G2 Ads'], status: 'template' },
      { campaign_name: 'Enterprise Outbound', campaign_type: 'linkedin_email', target_segment: 'Decision-makers at target company size + industry', budget_estimate: 2000, expected_roas: 7.0, channels: ['LinkedIn Sales Navigator', 'Email sequences'], status: 'template' },
      { campaign_name: 'Churn Win-Back', campaign_type: 'email', target_segment: 'Churned customers in last 6 months', budget_estimate: 300, expected_roas: 20.0, channels: ['Email', 'LinkedIn'], status: 'template' },
    ],
    hooks: [
      { hook_type: 'problem', hook_text: 'How much time is your team wasting on [pain point] every week? We calculated the real cost.', platform: 'LinkedIn', performance_score: 5 },
      { hook_type: 'roi', hook_text: 'Our customers save an average of 11 hours/week in the first 30 days. Here\'s the math.', platform: 'LinkedIn', performance_score: 5 },
      { hook_type: 'social_proof', hook_text: '4.8/5 on G2 from 800+ reviews. But don\'t take our word for it — here\'s what our customers actually say.', platform: 'Google Ads', performance_score: 4 },
      { hook_type: 'educational', hook_text: 'The 5-step framework our most successful customers use in their first week (free guide — no email required)', platform: 'Email', performance_score: 4 },
      { hook_type: 'comparison', hook_text: 'Still using spreadsheets for [use case]? Here\'s what switching to software actually looks like.', platform: 'LinkedIn', performance_score: 5 },
    ],
  },
];

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS industry_verticals (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      description TEXT DEFAULT '',
      target_audience TEXT DEFAULT '',
      revenue_models TEXT[] DEFAULT '{}',
      key_channels TEXT[] DEFAULT '{}',
      avg_deal_size NUMERIC DEFAULT 0,
      typical_pain_points TEXT[] DEFAULT '{}',
      ai_playbook TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vertical_campaigns (
      id SERIAL PRIMARY KEY,
      vertical_slug TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      campaign_type TEXT DEFAULT '',
      target_segment TEXT DEFAULT '',
      budget_estimate NUMERIC DEFAULT 0,
      expected_roas NUMERIC DEFAULT 0,
      channels TEXT[] DEFAULT '{}',
      status TEXT DEFAULT 'template',
      generated_copy TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vertical_content_hooks (
      id SERIAL PRIMARY KEY,
      vertical_slug TEXT NOT NULL,
      hook_type TEXT DEFAULT '',
      hook_text TEXT NOT NULL,
      platform TEXT DEFAULT '',
      performance_score INTEGER DEFAULT 3,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vertical_reports (
      id SERIAL PRIMARY KEY,
      vertical_slug TEXT NOT NULL,
      report_name TEXT NOT NULL,
      report_type TEXT DEFAULT 'playbook',
      content TEXT NOT NULL,
      generated_by TEXT DEFAULT 'ai',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedIfEmpty(client: import('pg').PoolClient) {
  const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM industry_verticals');
  if (rows[0].cnt > 0) return;

  for (const v of SEED_VERTICALS) {
    await client.query(
      `INSERT INTO industry_verticals (slug, name, icon, description, target_audience, revenue_models, key_channels, avg_deal_size, typical_pain_points, ai_playbook, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (slug) DO NOTHING`,
      [v.slug, v.name, v.icon, v.description, v.target_audience, v.revenue_models, v.key_channels, v.avg_deal_size, v.typical_pain_points, v.ai_playbook, v.status],
    );
    for (const c of v.campaigns) {
      await client.query(
        `INSERT INTO vertical_campaigns (vertical_slug, campaign_name, campaign_type, target_segment, budget_estimate, expected_roas, channels, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [v.slug, c.campaign_name, c.campaign_type, c.target_segment, c.budget_estimate, c.expected_roas, c.channels, c.status],
      );
    }
    for (const h of v.hooks) {
      await client.query(
        `INSERT INTO vertical_content_hooks (vertical_slug, hook_type, hook_text, platform, performance_score)
         VALUES ($1,$2,$3,$4,$5)`,
        [v.slug, h.hook_type, h.hook_text, h.platform, h.performance_score],
      );
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await seedIfEmpty(client);

    const { rows: verticals } = await client.query(`
      SELECT iv.*,
        (SELECT COUNT(*)::int FROM vertical_campaigns vc WHERE vc.vertical_slug = iv.slug) AS campaign_count,
        (SELECT COUNT(*)::int FROM vertical_content_hooks vh WHERE vh.vertical_slug = iv.slug) AS hook_count,
        (SELECT COUNT(*)::int FROM vertical_reports vr WHERE vr.vertical_slug = iv.slug) AS report_count
      FROM industry_verticals iv
      ORDER BY iv.name
    `);
    return Response.json({ verticals, total: verticals.length });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const { slug, name, icon, description, target_audience, revenue_models, key_channels, avg_deal_size, typical_pain_points } = body as Record<string, unknown>;
  if (typeof slug !== 'string' || !slug.trim()) return Response.json({ error: 'slug is required.' }, { status: 400 });
  if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'name is required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `INSERT INTO industry_verticals (slug, name, icon, description, target_audience, revenue_models, key_channels, avg_deal_size, typical_pain_points)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        slug.trim().toLowerCase().replace(/\s+/g, '-'),
        name,
        icon ?? '',
        description ?? '',
        target_audience ?? '',
        Array.isArray(revenue_models) ? revenue_models : [],
        Array.isArray(key_channels) ? key_channels : [],
        Number(avg_deal_size) || 0,
        Array.isArray(typical_pain_points) ? typical_pain_points : [],
      ],
    );
    return Response.json({ vertical: rows[0] }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('unique') || msg.includes('duplicate')) return Response.json({ error: 'A vertical with that slug already exists.' }, { status: 409 });
    throw e;
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS icp_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_name TEXT NOT NULL,
      industry TEXT,
      company_size TEXT,
      revenue_range TEXT,
      geography TEXT,
      job_titles TEXT[],
      pain_points TEXT[],
      goals TEXT[],
      buying_triggers TEXT[],
      objections TEXT[],
      channels TEXT[],
      budget_range TEXT,
      sales_cycle_days INT,
      is_primary BOOLEAN DEFAULT false,
      ai_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS acquisition_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      monthly_budget_cad NUMERIC(10,2) DEFAULT 0,
      monthly_spend_cad NUMERIC(10,2) DEFAULT 0,
      leads_generated_30d INT DEFAULT 0,
      cost_per_lead NUMERIC(10,2),
      conversion_rate NUMERIC(5,4),
      roi NUMERIC(6,3),
      attribution_model TEXT DEFAULT 'last_click',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS demand_gen_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      channel TEXT,
      campaign_type TEXT,
      target_audience TEXT,
      budget_cad NUMERIC(10,2),
      spend_cad NUMERIC(10,2) DEFAULT 0,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      leads INT DEFAULT 0,
      conversions INT DEFAULT 0,
      ctr NUMERIC(6,4),
      cpl NUMERIC(10,2),
      status TEXT DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS influencer_roster (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      platform TEXT,
      handle TEXT,
      profile_url TEXT,
      followers INT,
      avg_engagement_rate NUMERIC(5,4),
      niche TEXT[],
      location TEXT,
      email TEXT,
      status TEXT DEFAULT 'prospect',
      rate_per_post_cad NUMERIC(10,2),
      posts_completed INT DEFAULT 0,
      total_reach INT DEFAULT 0,
      total_leads INT DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function seedData(): Promise<void> {
  const [icpCount, channelCount, campaignCount, influencerCount] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM icp_profiles`),
    query(`SELECT COUNT(*)::int AS c FROM acquisition_channels`),
    query(`SELECT COUNT(*)::int AS c FROM demand_gen_campaigns`),
    query(`SELECT COUNT(*)::int AS c FROM influencer_roster`),
  ]);

  if ((icpCount.rows[0] as { c: number }).c === 0) {
    await query(`
      INSERT INTO icp_profiles
        (profile_name, industry, company_size, revenue_range, geography, job_titles, pain_points, goals, buying_triggers, objections, channels, budget_range, sales_cycle_days, is_primary, ai_summary)
      VALUES
        ('Enterprise Health & Wellness Director', 'Healthcare & Wellness', 'enterprise', '$10M–$50M', 'Canada, USA',
         ARRAY['VP Marketing','Director of Wellness','Chief People Officer'],
         ARRAY['Employee burnout','Low team retention','Rising benefits costs','Mental health stigma','No scalable wellness program'],
         ARRAY['Reduce absenteeism by 20%','Improve employee NPS','Meet DEI wellness mandates','Demonstrate ROI on wellness spend'],
         ARRAY['Q1 HR budget renewal','Post-merger culture integration','Government wellness incentive program'],
         ARRAY['Uncertain about adoption rates','ROI unclear','Existing vendor contracts'],
         ARRAY['LinkedIn','Email outreach','Industry conferences','Google Search'],
         '$50K–$200K/yr', 90, true,
         'Enterprise HR leader seeking scalable, measurable wellness solutions. Responds to case studies and ROI data. Procurement-driven buying process.'),

        ('SMB Owner — Fitness & Lifestyle', 'Retail & Wellness', 'smb', '$500K–$5M', 'Ontario, BC, Alberta',
         ARRAY['Owner','General Manager','Marketing Manager'],
         ARRAY['Customer churn after first purchase','Difficulty differentiating','Limited marketing budget','No loyalty program'],
         ARRAY['Grow repeat customer rate','Build brand community','Increase average order value'],
         ARRAY['Competitor losing market share','New location opening','Seasonal peak preparation'],
         ARRAY['Too expensive','Not enough time to manage','Need to see results fast'],
         ARRAY['Instagram','Google Ads','Local SEO','Referral programs'],
         '$5K–$25K/yr', 30, false,
         'Small business owner prioritising fast ROI, easy onboarding, and local market visibility.'),

        ('Wellness-Tech Startup Founder', 'SaaS / Digital Health', 'startup', '$0–$500K ARR', 'Remote, Toronto, Vancouver',
         ARRAY['CEO/Founder','Head of Growth','Product Lead'],
         ARRAY['No brand awareness','CAC too high','Churn above 8%','Struggling with PLG vs sales-led motion'],
         ARRAY['Hit $1M ARR within 12 months','Establish product-led growth loop','Build advisor network'],
         ARRAY['YC or accelerator demo day','Press coverage','Competitor funding announcement'],
         ARRAY['Unproven ROI','Integration complexity','Team bandwidth'],
         ARRAY['Twitter/X','LinkedIn','ProductHunt','Slack communities','Content marketing'],
         '$2K–$15K/yr', 14, false,
         'Founder looking for growth levers. Responds to peers, case studies, and transparent pricing. Short sales cycle, self-serve preferred.')
    `);
  }

  if ((channelCount.rows[0] as { c: number }).c === 0) {
    await query(`
      INSERT INTO acquisition_channels
        (channel_name, status, monthly_budget_cad, monthly_spend_cad, leads_generated_30d, cost_per_lead, conversion_rate, roi, attribution_model, notes)
      VALUES
        ('seo',            'active', 3000,  2800,  87,  32.18, 0.0420, 4.210, 'linear',     'Organic blog & on-page SEO. High ROI, slow ramp.'),
        ('google_ads',     'active', 8000,  7850, 142,  55.28, 0.0310, 2.840, 'last_click',  'Search + Performance Max. Top volume driver.'),
        ('linkedin_ads',   'active', 5000,  4920,  48, 102.50, 0.0180, 1.760, 'first_click', 'Enterprise ICP targeting. High CPL but strong SQL rate.'),
        ('facebook_ads',   'active', 4000,  3980,  96,  41.46, 0.0360, 3.120, 'last_click',  'Broad audiences + lookalikes. Good for SMB ICP.'),
        ('tiktok_ads',     'active', 2000,  1750,  34,  51.47, 0.0220, 1.940, 'last_click',  'Testing with awareness campaigns. CPL improving.'),
        ('display',        'active', 1500,  1420,  18,  78.89, 0.0090, 0.840, 'linear',     'Brand awareness only. ROI below breakeven — review.'),
        ('retargeting',    'active', 2500,  2480,  64,  38.75, 0.0480, 3.680, 'time_decay',  'High intent. Best conv rate across all channels.'),
        ('influencer',     'active', 3500,  3200,  29, 110.34, 0.0150, 1.240, 'first_click', 'Micro-influencers. Brand lift high, direct ROI low.'),
        ('referral',       'active', 500,    380,  41,   9.27, 0.0620, 7.840, 'first_click', 'Best CAC payback. Scale referral incentive program.'),
        ('cold_outbound',  'active', 1000,   960,  22,  43.64, 0.0280, 2.310, 'first_click', 'Sales-led. Works for enterprise ICP. Needs more volume.')
    `);
  }

  if ((campaignCount.rows[0] as { c: number }).c === 0) {
    await query(`
      INSERT INTO demand_gen_campaigns
        (name, channel, campaign_type, target_audience, budget_cad, spend_cad, impressions, clicks, leads, conversions, ctr, cpl, status, start_date, end_date)
      VALUES
        ('Brand Awareness — Wellness Q3',   'facebook_ads',  'awareness',      'Women 28-45, interest: wellness',    5000, 4800, 85000, 2210, 44, 8,  0.0260, 109.09, 'active',    '2026-07-01', '2026-09-30'),
        ('Google Search — Demo Requests',   'google_ads',    'conversion',     'HR Directors, Canada',               8000, 7200, 32000, 1840, 92, 21, 0.0575,  78.26, 'active',    '2026-08-01', '2026-10-31'),
        ('LinkedIn — Enterprise Outreach',  'linkedin_ads',  'consideration',  'VP HR, Enterprise, 500+ employees',  6000, 5500, 18000,  540, 31,  6, 0.0300, 177.42, 'active',    '2026-08-15', '2026-11-15'),
        ('Retargeting — Cart Abandoners',   'retargeting',   'retargeting',    'Website visitors — no conversion',   2500, 2400, 12000,  720, 58, 14, 0.0600,  41.38, 'active',    '2026-09-01', '2026-12-31'),
        ('TikTok — Gen Z Awareness',        'tiktok_ads',    'awareness',      'Ages 18-28, fitness & lifestyle',    2000, 1600, 95000, 1900, 22,  3, 0.0200,  72.73, 'active',    '2026-09-01', '2026-09-30'),
        ('Lookalike — Past Buyers',         'facebook_ads',  'lookalike',      'Lookalike of top 5% customers',      3500, 3200, 42000, 1050, 48,  9, 0.0250,  66.67, 'active',    '2026-08-01', '2026-10-31'),
        ('Email Nurture — MQL Sequence',    'email',         'consideration',  'MQLs 30-90d in pipeline',             800,  650,     0, 3200, 38, 11, 0.0000,  17.11, 'active',    '2026-07-01', '2026-12-31'),
        ('Webinar — ROI of Wellness',       'content',       'conversion',     'Enterprise HR, Benefits Managers',   1200, 1100,     0,  480, 27,  8, 0.0000,  40.74, 'completed', '2026-09-05', '2026-09-05')
    `);
  }

  if ((influencerCount.rows[0] as { c: number }).c === 0) {
    await query(`
      INSERT INTO influencer_roster
        (name, platform, handle, profile_url, followers, avg_engagement_rate, niche, location, email, status, rate_per_post_cad, posts_completed, total_reach, total_leads, notes)
      VALUES
        ('Sarah Chen',        'instagram', '@sarahwellness',   'https://instagram.com/sarahwellness',   128000, 0.0410, ARRAY['yoga','mindfulness','nutrition'],     'Toronto, ON',    'sarah@sarahwellness.ca',    'active',      850.00,  6, 768000, 34, 'Top performer. Authentic audience, high DM inquiries.'),
        ('Jake Fitness',      'tiktok',    '@jakefitmoves',    'https://tiktok.com/@jakefitmoves',      342000, 0.0820, ARRAY['hiit','fitness','lifestyle'],         'Vancouver, BC',  'jake@jakefitmoves.com',     'active',      1200.00, 3, 1026000, 18, 'TikTok native. Strong reach, lower conversion intent.'),
        ('Dr. Priya Mehta',   'linkedin',  'dr-priya-mehta',   'https://linkedin.com/in/dr-priya-mehta', 45000, 0.0320, ARRAY['corporate wellness','HR','burnout'], 'Calgary, AB',    'priya@drpriyamehta.com',    'active',      2200.00, 2, 90000,  22, 'High-authority enterprise audience. Best SQL-to-lead ratio.'),
        ('Mia Naturals',      'youtube',   'MiaNaturalsYT',    'https://youtube.com/miaNaturals',        89000, 0.0280, ARRAY['holistic health','clean beauty'],    'Montreal, QC',   'mia@mianaturals.ca',        'negotiating', 1800.00, 0, 0,       0,  'Contract pending. Rate negotiation in progress.'),
        ('TheFitDad',         'instagram', '@thefitdad_ca',    'https://instagram.com/thefitdad_ca',    56000, 0.0550, ARRAY['dad fitness','family wellness'],      'Ottawa, ON',     'contact@thefitdad.ca',      'outreach',     600.00, 0, 0,       0,  'Outreach sent 2026-09-10. Awaiting reply.'),
        ('Yoga with Kenji',   'youtube',   'YogaWithKenji',    'https://youtube.com/yogawithkenji',     215000, 0.0190, ARRAY['yoga','meditation','flexibility'],   'Remote',         'kenji@yogawithkenji.com',   'prospect',    2500.00, 0, 0,       0,  'Large audience, lower engagement. Good for awareness.'),
        ('RunnerGirlTO',      'tiktok',    '@runnergirlTO',    'https://tiktok.com/@runnergirlTO',      78000, 0.0640, ARRAY['running','marathon','female fitness'],'Toronto, ON',    'hello@runnergirlTO.com',    'completed',    700.00, 4, 312000, 12, 'Campaign concluded. Strong brand recall, low direct conv.'),
        ('Balanced Life Blog', 'instagram','@balancedlifeblog','https://instagram.com/balancedlifeblog', 32000, 0.0720, ARRAY['work-life balance','mental health'], 'Winnipeg, MB',   'lisa@balancedlifeblog.ca',  'prospect',     400.00, 0, 0,       0,  'Micro-influencer. High engagement, niche audience.')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    await ensureSchema();
    await seedData();

    const [icpRes, channelsRes, campaignsRes, influencersRes] = await Promise.all([
      query(`SELECT * FROM icp_profiles ORDER BY is_primary DESC, created_at DESC`),
      query(`SELECT * FROM acquisition_channels ORDER BY leads_generated_30d DESC`),
      query(`SELECT * FROM demand_gen_campaigns ORDER BY spend_cad DESC`),
      query(`SELECT * FROM influencer_roster ORDER BY status, followers DESC`),
    ]);

    const channels = channelsRes.rows as Array<{
      leads_generated_30d: number;
      monthly_spend_cad: number;
      cost_per_lead: number;
      roi: number;
      channel_name: string;
    }>;
    const campaigns = campaignsRes.rows as Array<{ spend_cad: number }>;

    const totalLeads = channels.reduce((s, c) => s + (c.leads_generated_30d ?? 0), 0);
    const totalSpend = channels.reduce((s, c) => s + Number(c.monthly_spend_cad ?? 0), 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const bestChannel = channels.reduce((best, c) => (c.leads_generated_30d > best.leads_generated_30d ? c : best), channels[0]);
    const avgConvRate = channels.reduce((s, c) => s + Number(c.roi ?? 0), 0) / (channels.length || 1);

    const totalImpressions = (campaignsRes.rows as Array<{ impressions: number }>).reduce((s, c) => s + (c.impressions ?? 0), 0);
    const totalClicks = (campaignsRes.rows as Array<{ clicks: number; leads: number; conversions: number }>).reduce((s, c) => s + (c.clicks ?? 0), 0);
    const totalCampaignLeads = (campaignsRes.rows as Array<{ leads: number }>).reduce((s, c) => s + (c.leads ?? 0), 0);
    const totalConversions = (campaignsRes.rows as Array<{ conversions: number }>).reduce((s, c) => s + (c.conversions ?? 0), 0);

    return Response.json({
      kpis: {
        totalLeads,
        avgCPL: Number(avgCPL.toFixed(2)),
        bestChannel: bestChannel?.channel_name ?? 'N/A',
        totalSpend: Number(totalSpend.toFixed(2)),
        avgROI: Number(avgConvRate.toFixed(3)),
      },
      funnel: {
        impressions: totalImpressions,
        clicks: totalClicks,
        leads: totalCampaignLeads,
        sqls: Math.round(totalCampaignLeads * 0.30),
        customers: totalConversions,
      },
      icpProfiles: icpRes.rows,
      channels: channelsRes.rows,
      campaigns: campaignsRes.rows,
      influencers: influencersRes.rows,
    });
  } catch (err) {
    console.error('[customer-acquisition] GET error:', err);
    return Response.json({ error: 'Failed to load acquisition data.' }, { status: 500 });
  }
}

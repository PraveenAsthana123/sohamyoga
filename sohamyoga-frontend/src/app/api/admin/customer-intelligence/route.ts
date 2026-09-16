import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLES = `
  CREATE TABLE IF NOT EXISTS customer_click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    customer_id UUID,
    visitor_id TEXT,
    event_type TEXT NOT NULL,
    page_path TEXT,
    element_id TEXT,
    element_text TEXT,
    element_type TEXT,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    device_type TEXT,
    browser TEXT,
    country TEXT,
    city TEXT,
    ip_hash TEXT,
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS social_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    external_id TEXT,
    author_name TEXT,
    author_handle TEXT,
    content TEXT,
    rating INT,
    sentiment TEXT,
    sentiment_score NUMERIC(4,3),
    language TEXT DEFAULT 'en',
    url TEXT,
    media_url TEXT,
    likes INT DEFAULT 0,
    replies INT DEFAULT 0,
    shares INT DEFAULT 0,
    is_responded BOOLEAN DEFAULT false,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    is_flagged BOOLEAN DEFAULT false,
    tags TEXT[],
    captured_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS insight_monitor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    platforms TEXT[] NOT NULL,
    keywords TEXT[],
    min_rating INT,
    alert_on TEXT[] DEFAULT ARRAY['negative', 'mention'],
    notify_email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS affiliate_click_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_code TEXT NOT NULL,
    affiliate_name TEXT,
    landing_page TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    device_type TEXT,
    country TEXT,
    converted BOOLEAN DEFAULT false,
    order_id UUID,
    commission_earned NUMERIC(10,2),
    clicked_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

async function seedData(pool: ReturnType<typeof getPool>) {
  const { rows: existing } = await pool.query('SELECT COUNT(*) as cnt FROM customer_click_events');
  if (parseInt(existing[0]?.cnt ?? '0', 10) > 0) return;

  const eventTypes = ['pageview','click','scroll','form_submit','video_play','cta_click','affiliate_click','ad_click','email_open','social_share'];
  const pages = ['/','/ classes','/pricing','/about','/contact','/blog','/videos','/schedule','/instructors','/products'];
  const sources = ['organic','paid','email','social','referral','direct'];
  const mediums = ['cpc','email','instagram','facebook','youtube','linkedin','organic'];
  const campaigns = ['summer-sale','yoga-beginner','newsletter-sep','referral-program','google-ads-q3'];
  const devices = ['desktop','mobile','tablet'];
  const browsers = ['chrome','firefox','safari','edge'];
  const elementTypes = ['button','link','image','video','form'];

  const eventValues: string[] = [];
  const eventParams: unknown[] = [];
  for (let i = 0; i < 50; i++) {
    const et = eventTypes[i % eventTypes.length];
    const page = pages[i % pages.length];
    const src = sources[i % sources.length];
    const med = mediums[i % mediums.length];
    const cam = campaigns[i % campaigns.length];
    const dev = devices[i % devices.length];
    const brw = browsers[i % browsers.length];
    const elt = elementTypes[i % elementTypes.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const base = i * 23 + 1;
    eventValues.push(`($${base},$${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},NOW() - INTERVAL '${daysAgo} days')`);
    eventParams.push(
      `sess-${i}`, et, page,
      `elem-${i}`, `Click me ${i}`, elt,
      src, med, cam, `https://ref${i}.example.com`,
      src, med, cam, dev, brw,
    );
  }

  // Simpler approach — individual inserts to avoid complex param numbering
  for (let i = 0; i < 50; i++) {
    const et = eventTypes[i % eventTypes.length];
    const page = pages[i % pages.length];
    const src = sources[i % sources.length];
    const med = mediums[i % mediums.length];
    const cam = campaigns[i % campaigns.length];
    const dev = devices[i % devices.length];
    const brw = browsers[i % browsers.length];
    const elt = elementTypes[i % elementTypes.length];
    const daysAgo = Math.floor((i * 7) % 30);
    await pool.query(
      `INSERT INTO customer_click_events (session_id, event_type, page_path, element_id, element_text, element_type, source, medium, campaign, referrer_url, utm_source, utm_medium, utm_campaign, device_type, browser, ip_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW() - INTERVAL '${daysAgo} days')`,
      [`sess-${i}`, et, page, `elem-${i}`, `CTA Button ${i}`, elt, src, med, cam,
       `https://ref.example.com/${i}`, src, med, cam, dev, brw, `hash${i}abc`],
    ).catch(() => {});
  }

  // Seed social insights
  const { rows: siExisting } = await pool.query('SELECT COUNT(*) as cnt FROM social_insights');
  if (parseInt(siExisting[0]?.cnt ?? '0', 10) === 0) {
    const platforms = ['facebook','instagram','youtube','google','yelp','linkedin'];
    const types = ['review','comment','mention','rating','share'];
    const sentiments = ['positive','neutral','negative'];
    const authors = ['Alice M.','Bob K.','Carol S.','David R.','Eva L.','Frank T.','Grace W.','Henry B.','Irene C.','James D.'];
    const contents = [
      'Amazing yoga classes! The instructors are so knowledgeable and welcoming.',
      'Good experience overall but the app could be more user-friendly.',
      'Totally transformed my practice. Highly recommended!',
      'Average class, nothing special.',
      'The online videos are top-notch. Worth every penny.',
      'Some classes were too crowded. Could improve scheduling.',
      'Love the community here! Everyone is supportive.',
      'My first yoga class was intimidating but the teacher made it easy.',
      'Great value for money. Multiple class formats to choose from.',
      'Not what I expected. The beginner class was still quite advanced.',
      'Absolutely fantastic! Best yoga studio in town.',
      'Decent classes, friendly staff.',
      'The meditation sessions are life-changing.',
      'Wish they had more early morning slots.',
      'Five stars! Will definitely come back and bring friends.',
      'Good enough for a casual practitioner.',
      'The breathing exercises helped my anxiety enormously.',
      'Online booking system needs improvement.',
      'Loved the retreat weekend package!',
      'Teacher was late to two sessions — disappointing.',
      'Best prenatal yoga classes I have attended.',
      'Nice atmosphere, great music selection.',
      'My back pain is gone after 3 months of classes here.',
      'Prices are a bit high compared to competitors.',
      'The app notification system is very helpful!',
    ];

    for (let i = 0; i < 25; i++) {
      const platform = platforms[i % platforms.length];
      const insightType = types[i % types.length];
      const sentiment = sentiments[i % sentiments.length];
      const score = sentiment === 'positive' ? 0.8 + (i % 3) * 0.05
        : sentiment === 'negative' ? 0.1 + (i % 3) * 0.05 : 0.5;
      const rating = insightType === 'review' || insightType === 'rating'
        ? (sentiment === 'positive' ? 4 + (i % 2) : sentiment === 'negative' ? 1 + (i % 2) : 3)
        : null;
      const daysAgo = Math.floor((i * 4) % 60);
      await pool.query(
        `INSERT INTO social_insights (platform, insight_type, author_name, author_handle, content, rating, sentiment, sentiment_score, likes, replies, is_responded, captured_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW() - INTERVAL '${daysAgo} days')`,
        [platform, insightType, authors[i % authors.length], `@user${i}`,
         contents[i % contents.length], rating, sentiment, score,
         Math.floor(i * 3.7), Math.floor(i * 0.8), i % 3 === 0],
      ).catch(() => {});
    }
  }

  // Seed monitor rules
  const { rows: mrExisting } = await pool.query('SELECT COUNT(*) as cnt FROM insight_monitor_rules');
  if (parseInt(mrExisting[0]?.cnt ?? '0', 10) === 0) {
    await pool.query(
      `INSERT INTO insight_monitor_rules (rule_name, platforms, keywords, min_rating, alert_on, notify_email) VALUES
       ('Negative Review Alert', ARRAY['google','yelp','facebook'], ARRAY['bad','terrible','worst','refund'], 2, ARRAY['negative'], 'admin@sohamyoga.com'),
       ('Brand Mention Monitor', ARRAY['instagram','twitter','tiktok'], ARRAY['sohamyoga','soham yoga','@sohamyoga'], NULL, ARRAY['mention'], 'marketing@sohamyoga.com'),
       ('YouTube Comment Watch', ARRAY['youtube'], ARRAY['spam','inappropriate','unsubscribe'], NULL, ARRAY['negative','mention'], 'content@sohamyoga.com')`,
    ).catch(() => {});
  }

  // Seed affiliate clicks
  const { rows: acExisting } = await pool.query('SELECT COUNT(*) as cnt FROM affiliate_click_log');
  if (parseInt(acExisting[0]?.cnt ?? '0', 10) === 0) {
    const affiliates = [
      { code: 'YOGA10', name: 'Sarah Wellness Blog' },
      { code: 'FIT20', name: 'FitLife Reviews' },
      { code: 'MIND15', name: 'Mindful Living Channel' },
    ];
    const countries = ['US','CA','GB','AU','IN'];
    const devs = ['desktop','mobile','tablet'];
    for (let i = 0; i < 15; i++) {
      const aff = affiliates[i % affiliates.length];
      const converted = i % 4 === 0;
      const commission = converted ? parseFloat((29.99 * 0.1).toFixed(2)) : null;
      const daysAgo = Math.floor((i * 2) % 30);
      await pool.query(
        `INSERT INTO affiliate_click_log (affiliate_code, affiliate_name, landing_page, utm_source, device_type, country, converted, commission_earned, clicked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() - INTERVAL '${daysAgo} days')`,
        [aff.code, aff.name, '/pricing', aff.code.toLowerCase(), devs[i % devs.length],
         countries[i % countries.length], converted, commission],
      ).catch(() => {});
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLES);
    await seedData(pool);

    const [
      totalClicks,
      byEventType,
      topPages,
      bySource,
      byCampaign,
      byDevice,
      funnelData,
      topReferrers,
      dailyTrend,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(DISTINCT visitor_id) as unique_visitors FROM customer_click_events WHERE created_at > NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT event_type, COUNT(*) as cnt FROM customer_click_events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY event_type ORDER BY cnt DESC`),
      pool.query(`SELECT page_path, COUNT(*) as pageviews FROM customer_click_events WHERE event_type = 'pageview' AND created_at > NOW() - INTERVAL '30 days' GROUP BY page_path ORDER BY pageviews DESC LIMIT 10`),
      pool.query(`SELECT COALESCE(source,'direct') as source, COUNT(*) as cnt FROM customer_click_events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY source ORDER BY cnt DESC`),
      pool.query(`SELECT utm_campaign, utm_source, utm_medium, COUNT(*) as clicks FROM customer_click_events WHERE utm_campaign IS NOT NULL AND created_at > NOW() - INTERVAL '30 days' GROUP BY utm_campaign, utm_source, utm_medium ORDER BY clicks DESC LIMIT 20`),
      pool.query(`SELECT COALESCE(device_type,'desktop') as device_type, COUNT(*) as cnt FROM customer_click_events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY device_type`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE event_type='pageview') as pageviews,
        COUNT(*) FILTER (WHERE event_type='cta_click') as cta_clicks,
        COUNT(*) FILTER (WHERE event_type='form_submit') as form_submits
        FROM customer_click_events WHERE created_at > NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT referrer_url, COUNT(*) as cnt FROM customer_click_events WHERE referrer_url IS NOT NULL AND created_at > NOW() - INTERVAL '30 days' GROUP BY referrer_url ORDER BY cnt DESC LIMIT 10`),
      pool.query(`SELECT DATE(created_at) as day, COUNT(*) as clicks FROM customer_click_events WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day ASC`),
    ]);

    const total = parseInt(totalClicks.rows[0]?.total ?? '0', 10);
    const uniqueVisitors = parseInt(totalClicks.rows[0]?.unique_visitors ?? '0', 10);
    const pv = parseInt(funnelData.rows[0]?.pageviews ?? '0', 10);
    const ctas = parseInt(funnelData.rows[0]?.cta_clicks ?? '0', 10);
    const forms = parseInt(funnelData.rows[0]?.form_submits ?? '0', 10);
    const convRate = pv > 0 ? ((forms / pv) * 100).toFixed(1) : '0.0';

    return Response.json({
      overview: {
        total_clicks: total,
        unique_visitors: uniqueVisitors,
        pageviews: pv,
        conversion_rate: `${convRate}%`,
      },
      by_event_type: byEventType.rows,
      top_pages: topPages.rows,
      by_source: bySource.rows,
      by_campaign: byCampaign.rows,
      by_device: byDevice.rows,
      funnel: { pageviews: pv, cta_clicks: ctas, form_submits: forms },
      top_referrers: topReferrers.rows,
      daily_trend: dailyTrend.rows,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

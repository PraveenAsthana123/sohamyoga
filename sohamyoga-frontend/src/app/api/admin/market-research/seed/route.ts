import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  // 1. Create tables
  await query(`CREATE TABLE IF NOT EXISTS market_research_project (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    owner VARCHAR(100),
    description TEXT,
    target_market TEXT,
    geography VARCHAR(100),
    industry VARCHAR(100),
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS market_research_scenario (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES market_research_project(id) ON DELETE CASCADE,
    scenario_name VARCHAR(200) NOT NULL,
    scenario_type VARCHAR(50),
    description TEXT,
    data_sources TEXT,
    methodology TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    output_format VARCHAR(30),
    ai_assisted BOOLEAN DEFAULT false,
    result_summary TEXT,
    result_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`);

  await query(`CREATE TABLE IF NOT EXISTS market_research_document (
    id SERIAL PRIMARY KEY,
    project_id INT,
    scenario_id INT,
    document_type VARCHAR(30),
    title VARCHAR(300),
    content TEXT,
    format VARCHAR(20) DEFAULT 'markdown',
    word_count INT,
    generated_by VARCHAR(30),
    version INT DEFAULT 1,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS market_competitor (
    id SERIAL PRIMARY KEY,
    project_id INT,
    company_name VARCHAR(200) NOT NULL,
    website VARCHAR(300),
    industry VARCHAR(100),
    founded_year INT,
    hq_location VARCHAR(100),
    employee_range VARCHAR(50),
    revenue_range VARCHAR(50),
    market_position VARCHAR(30),
    strengths TEXT,
    weaknesses TEXT,
    key_products TEXT,
    pricing_model VARCHAR(100),
    target_audience TEXT,
    social_presence JSONB DEFAULT '{}',
    threat_level VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS market_insight (
    id SERIAL PRIMARY KEY,
    project_id INT,
    insight_type VARCHAR(50),
    title VARCHAR(200),
    body TEXT,
    confidence_score DECIMAL(3,2),
    source VARCHAR(100),
    ai_generated BOOLEAN DEFAULT false,
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // 2. Check if already seeded
  const existing = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM market_research_project`);
  if (Number(existing.rows[0].count) > 0) {
    return Response.json({ ok: true, message: 'Tables already seeded — skipping.' });
  }

  // 3. Seed Project 1: Yoga Market Entry Canada 2026
  const p1 = await query<{ id: string }>(
    `INSERT INTO market_research_project (name, category, status, owner, description, target_market, geography, industry, tags)
     VALUES ($1,'market_sizing','in_progress','Admin','Comprehensive market sizing study for yoga studio entry into Canadian market','Health-conscious adults 25-55, urban professionals','Canada','Health & Wellness','yoga,canada,market-entry,2026')
     RETURNING id`,
    ['Yoga Market Entry Canada 2026'],
  );
  const p1id = Number(p1.rows[0].id);

  // Scenarios for p1
  await query(
    `INSERT INTO market_research_scenario (project_id, scenario_name, scenario_type, description, data_sources, methodology, status, output_format, ai_assisted)
     VALUES
     ($1,'Population & TAM Sizing','secondary_research','Size the total addressable market for yoga in Canada','Statistics Canada, IBISWorld, Statista','Top-down TAM/SAM/SOM analysis','complete','detailed_report',true),
     ($1,'Consumer Survey Analysis','survey','Survey yoga practitioners across major Canadian cities','Typeform survey, 500 respondents','Quantitative survey, stratified sampling','in_progress','excel',false),
     ($1,'Pricing Benchmarking','competitive_intel','Map yoga studio pricing across Ontario and BC','Studio websites, Google Maps, mystery shopping','Price scraping + position mapping','complete','short_report',false),
     ($1,'AI Market Synthesis','ai_synthesis','Synthesize all research inputs for executive report','All above sources','Ollama synthesis + structured review','pending','detailed_report',true)`,
    [p1id],
  );

  // Short report doc for p1
  await query(
    `INSERT INTO market_research_document (project_id, document_type, title, content, format, word_count, generated_by, is_published)
     VALUES
     ($1,'short_report','Canada Yoga Market: Executive Brief','# Canada Yoga Market: Executive Brief\n\n## Executive Summary\nThe Canadian yoga market represents a $1.2B opportunity with 8% YoY growth. Urban centres show the highest concentration of practitioners.\n\n## Key Findings\n- 4.1M Canadians practice yoga regularly (Statistics Canada 2024)\n- Average monthly spend: $85-$120 per practitioner\n- Digital/hybrid studios growing 34% faster than pure brick-and-mortar\n\n## Market Opportunity\nThe Ontario and BC markets are underserved in the premium online-hybrid segment, with a gap for culturally-responsive wellness platforms.\n\n## Recommended Next Steps\n1. Focus initial market entry on Toronto and Vancouver metro areas\n2. Develop hybrid digital/in-studio offering\n3. Target 25-40 urban professionals as primary segment','markdown',120,'hybrid',true),
     ($1,'detailed_report','Canada Yoga Market Full Analysis 2026','# Canada Yoga Market Full Analysis 2026\n\n## 1. Executive Summary\nThis report presents comprehensive market research for yoga studio entry into Canada in 2026...\n\n## 2. Market Overview & Size\n- Total market: ~$1.2B CAD\n- CAGR: 8.2% (2022-2026)\n- Practitioners: 4.1M\n\n## 3. Competitive Landscape\nMindbody and ClassPass dominate digital booking; local studios are fragmented.\n\n## 4. Customer Segmentation\n- Urban professionals (35%)\n- Students (20%)\n- Seniors wellness (15%)\n- Athletes cross-training (30%)\n\n## 5. Trend Analysis\nVirtual classes, wearable integration, and mindfulness bundling are the top 3 macro trends.\n\n## 6. SWOT Analysis\n**Strengths:** Low infrastructure cost for digital model\n**Weaknesses:** Brand recognition gap vs. established players\n**Opportunities:** Premium hybrid market is underserved\n**Threats:** Peloton and FitOn digital disruption\n\n## 7. Growth Opportunities\nSubscription + class-pack hybrid monetization, corporate wellness partnerships.\n\n## 8. Risk Factors\nRegulatory variation by province; currency volatility for pricing.\n\n## 9. Strategic Recommendations\nLaunch in Toronto → Vancouver → Calgary with regional pricing.\n\n## 10. Appendix: Data Sources\nStatistics Canada, IBISWorld Wellness 2024, Mindbody Industry Report 2025','markdown',280,'ai',false)`,
    [p1id],
  );

  // 4. Seed Project 2: Competitor Intelligence
  const p2 = await query<{ id: string }>(
    `INSERT INTO market_research_project (name, category, status, owner, description, target_market, geography, industry, tags)
     VALUES ($1,'competitor_analysis','complete','Admin','Deep-dive competitive intelligence on major online wellness platforms','Online yoga/fitness subscribers globally','Global','Health & Wellness, EdTech','competitors,wellness,platforms,analysis')
     RETURNING id`,
    ['Competitor Intelligence: Online Wellness Platforms'],
  );
  const p2id = Number(p2.rows[0].id);

  // 6 competitors
  await query(
    `INSERT INTO market_competitor (project_id, company_name, website, industry, founded_year, hq_location, employee_range, revenue_range, market_position, strengths, weaknesses, key_products, pricing_model, target_audience, social_presence, threat_level, notes)
     VALUES
     ($1,'Mindbody','mindbody.io','Health & Wellness Tech',2001,'San Luis Obispo, CA','1000-5000','$100M-$250M','leader','Industry-leading booking platform; 35M+ users; strong B2B integrations','High pricing for studios; UI complexity; limited AI features','Studio management, client app, marketing tools','$139-$599/month per studio','Yoga/fitness studio owners and their clients','{"instagram": "2.1M", "facebook": "850K"}','critical','Dominant market player; direct competitor for studio management'),
     ($1,'ClassPass','classpass.com','Health & Wellness Tech',2013,'New York, NY','500-1000','$50M-$100M','challenger','Massive class inventory; flexible credit model; corporate wellness','Low per-class studio revenue share; credit confusion','Class credits, corporate wellness, live streaming','$19-$99/month per user','Fitness explorers, urban professionals','{"instagram": "580K", "facebook": "230K"}','high','Consumer-side aggregator; competes for studio attention'),
     ($1,'Wellhub (Gympass)','wellhub.com','Corporate Wellness',2012,'New York, NY','1000-5000','$250M+','leader','Largest corporate wellness network; 15K+ enterprise clients','B2B only; no direct consumer app; complex integration','Corporate wellness stipends, partner network access','Enterprise contract (per-employee)','HR managers, large enterprises','{"linkedin": "85K", "instagram": "45K"}','high','Corporate wellness arm; threat if they add digital studio tools'),
     ($1,'Peloton','onepeloton.com','Connected Fitness',2012,'New York, NY','5000+','$700M+','leader','Brand recognition; premium hardware+content flywheel; 6M+ members','Hardware dependency; subscription fatigue; post-COVID slowdown','Bike, tread, app, classes, instructor brand','$44/month (app) + hardware','Affluent fitness enthusiasts, home workout adopters','{"instagram": "4.2M", "facebook": "2.1M"}','critical','Category-defining brand; not direct competitor but anchors consumer expectations'),
     ($1,'FitOn','fitonapp.com','Fitness App',2019,'Los Angeles, CA','50-200','<$50M','emerging','Free-first model; celebrity instructors; rapid growth','Limited monetization; no studio marketplace; thin community','Free fitness classes, premium PRO plan, corporate wellness','Free + $29.99/year PRO','Fitness beginners, budget-conscious consumers','{"instagram": "315K", "tiktok": "220K"}','medium','Freemium disruptor; erodes willingness to pay'),
     ($1,'Down Dog','downdogapp.com','Yoga App',2016,'Washington, DC','10-50','<$10M','niche','Highly-rated yoga app; adaptive AI sequencing; strong UX','No community/social; studio management absent; limited content breadth','Yoga, HIIT, running, meditation apps','$7.99/month or $49.99/year','Self-guided yoga practitioners, home practitioners','{"instagram": "95K"}','medium','Niche yoga app with excellent UX; competes for digital-only practitioners')`,
    [p2id],
  );

  // 5. Seed Project 3: Emerging Wellness Trends 2026
  const p3 = await query<{ id: string }>(
    `INSERT INTO market_research_project (name, category, status, owner, description, target_market, geography, industry, tags)
     VALUES ($1,'trend_analysis','in_progress','Admin','Tracking macro and micro wellness trends shaping 2026 consumer behavior','Wellness consumers globally, brands, investors','Global','Health & Wellness','trends,2026,wellness,emerging')
     RETURNING id`,
    ['Emerging Wellness Trends 2026'],
  );
  const p3id = Number(p3.rows[0].id);

  // 5 insights for p3
  await query(
    `INSERT INTO market_insight (project_id, insight_type, title, body, confidence_score, source, ai_generated, tags)
     VALUES
     ($1,'trend','AI-Personalized Wellness Plans Becoming Standard','Consumers now expect AI-driven personalization for workout, nutrition, and recovery recommendations. Platforms without AI personalization see 23% higher churn in 2025. Integration with wearables (Apple Watch, Garmin) is the primary data source.',0.92,'Mindbody 2025 Industry Report, McKinsey Health',true,'ai,personalization,wearables'),
     ($1,'opportunity','Corporate Wellness Market Surging Post-COVID','The corporate wellness contract market grew 31% in 2025. SMBs under 500 employees are largely unserved. Bundled yoga + mental wellness programs see highest engagement (NPS 72 vs. 48 for fitness-only programs).',0.88,'Wellhub Business Report, Deloitte Insights 2025',true,'corporate,b2b,opportunity'),
     ($1,'threat','Subscription Fatigue Eroding Willingness to Pay','Average consumer holds 4.2 wellness subscriptions (2025, up from 2.8 in 2022). Cancellation rates for platforms priced above $25/month increased 18% YoY. Free-tier platforms (FitOn, YouTube) are capturing price-sensitive segments.',0.85,'McKinsey Consumer Survey 2025, Paddle Revenue Data',true,'pricing,churn,threat'),
     ($1,'gap','Mental Wellness + Physical Practice Integration Underserved','Only 12% of yoga apps integrate guided meditation, breathwork, and sleep tracking into a unified wellness journey. Consumer demand for holistic mind-body platforms scores 8.4/10 in satisfaction surveys.',0.79,'GlobalWellnessInstitute 2025, App Store Review Analysis',true,'mental-health,integration,gap'),
     ($1,'prediction','Hybrid Digital-Physical Membership Model Will Dominate by 2027','Prediction: 65% of yoga/fitness revenue will flow through hybrid (digital class access + local studio credits) models by 2027. Pure digital-only and pure brick-and-mortar both show declining share. Early movers who launch hybrid before Q3 2026 capture disproportionate brand equity.',0.74,'SohamYoga Internal Analysis + Industry Extrapolation',true,'prediction,hybrid,2027')`,
    [p3id],
  );

  return Response.json({
    ok: true,
    message: 'Tables created and seeded successfully.',
    seeded: {
      projects: 3,
      scenarios: 4,
      documents: 2,
      competitors: 6,
      insights: 5,
    },
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS sales_intel_deals (
    id SERIAL PRIMARY KEY, company TEXT, contact TEXT, value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'prospecting', probability INTEGER DEFAULT 10, next_action TEXT,
    next_action_date DATE, ai_notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS sales_knowledge_base (
    id SERIAL PRIMARY KEY, title TEXT, category TEXT, content TEXT, tags TEXT[],
    usage_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS sales_ai_queries (
    id SERIAL PRIMARY KEY, question TEXT, context TEXT, answer TEXT,
    helpful BOOLEAN, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM sales_intel_deals');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO sales_intel_deals (company, contact, value, stage, probability, next_action, next_action_date, ai_notes) VALUES
      ('TechCorp Inc','HR Director Jennifer K',4800,'proposal',65,'Send revised deck with ROI calculator','2026-09-20','Strong interest. Budget approved. Competing with MindfulAtWork. Emphasize live instructor advantage.'),
      ('Global Insurance Co','Wellness Head Maria S',12000,'negotiation',80,'Final pricing call scheduled','2026-09-18','Key concern: scheduling flexibility. Offered custom time slots. Near close.'),
      ('StartupHub Toronto','CEO Alex R',960,'qualifying',40,'Discovery call — confirm headcount','2026-09-22','Early stage. 15-20 employees. Budget TBD. Strong wellness culture fit.'),
      ('Canadian Bank','Corp Wellness Lisa P',24000,'closed won',100,'Onboard new participants for Week 2','2026-09-17','Closed! 6-month pilot, 200 employees. Contract signed 2026-09-15.'),
      ('RBC Wealth','EVP David C',18000,'prospecting',15,'LinkedIn connect + personalized email','2026-09-25','Cold outreach. Warm intro from Canadian Bank contact.'),
      ('MediTech Solutions','CHRO Sarah B',7200,'proposal',55,'Follow up on proposal sent 2 days ago','2026-09-21','Strong pain point: high burnout rates. Medical staff. Emphasize stress reduction data.'),
      ('Law Firm Partners','Office Manager Tom',3600,'closed lost',0,'Archive — competitor chosen','2026-09-01','Lost to competitor on price. Follow up in Q1 2027.'),
      ('EduFirst College','Facilities Dir Amy',6000,'qualifying',35,'Campus visit scheduled','2026-09-23','Student and staff program. Seasonal demand. Long sales cycle.')
    `);
    await client.query(`INSERT INTO sales_knowledge_base (title, category, content, tags, usage_count) VALUES
      ('ROI Calculator: Corporate Wellness','objection-handling','Companies with wellness programs see average 28% reduction in sick days, 20% improvement in productivity, and 3:1 ROI within 12 months. For a 100-employee company: if avg sick day costs $400, 28% reduction = $112K annual savings.',ARRAY['roi','pricing','enterprise'],34),
      ('Competitor Differentiation vs MindfulAtWork','competitive','Our key advantages: live certified instructors vs pre-recorded, custom scheduling vs fixed, multilingual support, and dedicated account manager. MindfulAtWork has broader content library but no live interaction.',ARRAY['competitive','mindfulatwork','differentiation'],28),
      ('PIPEDA Data Privacy Compliance Proof','compliance','Our platform is fully PIPEDA compliant. Data is stored on Canadian servers, encrypted at rest and in transit. We sign DPAs with enterprise clients. No third-party data sharing. SOC 2 Type II audit in progress.',ARRAY['compliance','privacy','enterprise','legal'],19),
      ('Pricing Tiers — Corporate Packages','pricing','Team (10-25): $960/yr. Growth (26-75): $2,400/yr. Enterprise (76-200): $7,200/yr. Enterprise+ (200+): Custom pricing. All include live sessions, progress tracking, dedicated instructor.',ARRAY['pricing','tiers','enterprise'],45),
      ('Case Study: HealthFirst Insurance (500 employees)','social-proof','Challenge: 34% of employees reporting burnout. Solution: Bi-weekly virtual sessions + monthly live workshops. Result: 22% stress reduction (self-reported), 18% reduction in health insurance claims, 4.7/5 NPS.',ARRAY['case-study','insurance','results'],52),
      ('Onboarding Process — Enterprise','process','Week 1: Account setup + instructor assignment. Week 2: Kick-off session with leadership. Weeks 3-4: Soft launch with pilot group (20-30 employees). Month 2: Full rollout. Month 3: First impact assessment.',ARRAY['onboarding','process','enterprise'],23)
    `);
    await client.query(`INSERT INTO sales_ai_queries (question, context, answer, helpful) VALUES
      ('How do I handle the "it is too expensive" objection?','Enterprise deal, $7200/yr budget concern','Lead with ROI: our Enterprise clients average 3:1 ROI within 12 months. Offer to model specific savings based on their headcount and current sick day costs. Consider a 3-month pilot at reduced rate to prove value.',true),
      ('What are the strongest differentiators vs app-based competitors?','Prospect comparing to Headspace for Work','Three wins: 1) Live certified instructors — human connection increases completion rates by 3x. 2) Custom scheduling around their team''s calendar. 3) Group cohesion — shared experience vs solo listening.',true),
      ('How long is typical sales cycle for enterprise deals?','New enterprise prospect, $15K+ deal','Enterprise wellness deals average 4-8 weeks from first call to signed contract. Key milestones: discovery (1-2 calls), proposal (1 week), legal review (1-2 weeks), final approval. Budget cycles matter — Q4 hardest to close.',true)
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
    const [deals, stats] = await Promise.all([
      client.query('SELECT * FROM sales_intel_deals ORDER BY probability DESC, value DESC'),
      client.query(`SELECT COALESCE(SUM(value),0) as pipeline_total,
        COALESCE(SUM(value * probability::NUMERIC/100),0) as weighted_forecast,
        COALESCE(AVG(value),0) as avg_deal_size,
        COUNT(*) FILTER (WHERE stage='closed won') as won_count,
        COUNT(*) FILTER (WHERE stage='closed lost') as lost_count
        FROM sales_intel_deals`),
    ]);
    return Response.json({ deals: deals.rows, stats: stats.rows[0] });
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
      `INSERT INTO sales_intel_deals (company, contact, value, stage, probability, next_action, next_action_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.company, body.contact, body.value || 0, body.stage || 'prospecting', body.probability || 10, body.next_action, body.next_action_date]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

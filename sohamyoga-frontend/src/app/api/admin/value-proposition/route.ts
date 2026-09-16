import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS value_proposition (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        segment TEXT NOT NULL,
        customer_jobs TEXT[],
        pains TEXT[],
        gains TEXT[],
        products_services TEXT[],
        pain_relievers TEXT[],
        gain_creators TEXT[],
        fit_score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        channel TEXT,
        version INTEGER DEFAULT 1,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed 3 value propositions
    const seeds = [
      {
        title: 'Digital Agency Growth Partner',
        segment: 'Digital Marketing Agencies',
        customer_jobs: ['Manage multiple client campaigns efficiently','Demonstrate ROI to retain clients','Scale operations without proportional headcount increases','Differentiate agency offerings in a crowded market'],
        pains: ['Too many disconnected tools and dashboards','Difficulty showing measurable results to clients','Manual reporting takes too many hours each week','Client churn due to lack of transparency'],
        gains: ['One unified dashboard for all client metrics','Automated reports that impress clients','AI-powered insights that find revenue opportunities','White-label capabilities to brand as their own'],
        products_services: ['Unified analytics platform','White-label reporting suite','AI campaign optimization','Multi-client management console','Automated performance alerts'],
        pain_relievers: ['Consolidates all campaign data into single view','One-click automated client reports','Real-time performance alerts eliminate manual checks','Full client portal with agency branding'],
        gain_creators: ['AI recommendations increase average client ROAS by 40%','Automated reporting saves 8+ hours per week','Transparent dashboards reduce client churn by 30%','Scalable architecture supports 10x client growth'],
        fit_score: 85,
        status: 'validated',
        channel: 'outbound_sales',
        version: 2,
      },
      {
        title: 'SMB Marketing Automation Suite',
        segment: 'SMB Business Owners',
        customer_jobs: ['Attract more customers without big marketing budgets','Understand which marketing channels actually work','Automate repetitive marketing tasks','Compete with larger businesses online'],
        pains: ['Limited marketing budget with uncertain ROI','No time to learn complex marketing tools','Hard to know what is and is not working','Expensive agencies that overpromise and underdeliver'],
        gains: ['Predictable customer acquisition cost','Simple tools that work without expertise','Clear attribution showing which spend drives results','Enterprise-grade marketing at SMB prices'],
        products_services: ['Affordable CRM and pipeline management','Email marketing automation','Social media scheduling','Basic analytics dashboard','Lead capture and nurture flows'],
        pain_relievers: ['Transparent pricing — no hidden fees','5-minute setup with guided onboarding','Automated attribution shows exactly what drives sales','Pre-built templates for non-marketers'],
        gain_creators: ['Average 3x ROAS for SMB clients in first 90 days','Saves 10 hours/week on manual marketing tasks','25% increase in lead conversion rate','Pay only for what you use — no agency markup'],
        fit_score: 72,
        status: 'validated',
        channel: 'inbound_content',
        version: 1,
      },
      {
        title: 'Wellness Studio Growth Engine',
        segment: 'Yoga & Wellness Studios',
        customer_jobs: ['Fill class schedules consistently','Build community around the studio brand','Retain students long-term','Expand beyond physical location with digital offerings'],
        pains: ['Class cancellations due to low enrollment','Students attend once and never return','Social media presence feels disconnected from bookings','No easy way to sell digital courses or memberships'],
        gains: ['Full class capacity with waitlists','Loyal community that refers friends','Seamless online booking and payment','Recurring revenue from memberships and digital content'],
        products_services: ['Online booking and scheduling integration','Email/SMS class reminder automation','Social content calendar and posting','Membership and subscription management','Video course delivery platform'],
        pain_relievers: ['Automated reminder sequences reduce no-shows by 60%','Loyalty points program increases repeat attendance','One-click social posting tied to booking calendar','Built-in membership billing with zero transaction fees'],
        gain_creators: ['Studios see 40% more class bookings in first month','Community features increase 90-day retention by 50%','Digital memberships create $2k–$8k/mo recurring revenue','Referral program generates 30% of new student signups'],
        fit_score: 78,
        status: 'live',
        channel: 'referral_partnership',
        version: 3,
      },
    ];

    for (const s of seeds) {
      await client.query(
        `INSERT INTO value_proposition
           (title,segment,customer_jobs,pains,gains,products_services,pain_relievers,gain_creators,fit_score,status,channel,version)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
         WHERE NOT EXISTS (SELECT 1 FROM value_proposition WHERE segment=$2)`,
        [s.title,s.segment,s.customer_jobs,s.pains,s.gains,s.products_services,s.pain_relievers,s.gain_creators,s.fit_score,s.status,s.channel,s.version],
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM value_proposition ORDER BY created_at DESC').catch(() => ({ rows: [] }));
    return Response.json({ propositions: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const {
    title, segment, customer_jobs, pains, gains,
    products_services, pain_relievers, gain_creators,
    fit_score, status, channel, notes,
  } = body;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO value_proposition
         (title,segment,customer_jobs,pains,gains,products_services,pain_relievers,gain_creators,fit_score,status,channel,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [title,segment,customer_jobs??[],pains??[],gains??[],products_services??[],pain_relievers??[],gain_creators??[],fit_score??0,status??'draft',channel??null,notes??null],
    );
    return Response.json({ proposition: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const allowed = ['title','segment','customer_jobs','pains','gains','products_services','pain_relievers','gain_creators','fit_score','status','channel','notes','version'] as const;
  const setClauses: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      vals.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });
  vals.push(id);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE value_proposition SET ${setClauses.join(',')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ proposition: result.rows[0] });
  } finally {
    client.release();
  }
}

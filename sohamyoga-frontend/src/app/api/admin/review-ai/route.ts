export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS review_entities (
    id SERIAL PRIMARY KEY, review_text TEXT, entities JSONB, sentiment TEXT,
    topics TEXT[], products_mentioned TEXT[], staff_mentioned TEXT[], created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS complaint_classifications (
    id SERIAL PRIMARY KEY, complaint_text TEXT, category TEXT, subcategory TEXT,
    priority TEXT DEFAULT 'medium', sentiment_score NUMERIC DEFAULT 0,
    escalation_required BOOLEAN DEFAULT FALSE, suggested_response TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS legal_escalations (
    id SERIAL PRIMARY KEY, review_id TEXT, platform TEXT, content_excerpt TEXT,
    reason TEXT, status TEXT DEFAULT 'under_review', assigned_to TEXT, legal_notes TEXT,
    resolution TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM review_entities');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO review_entities (review_text, entities, sentiment, topics, products_mentioned, staff_mentioned) VALUES
      ('Sarah was absolutely incredible! The morning yoga class completely transformed my stiff back. The studio is spotless and the Sunrise Flow package is worth every penny.','{"people":["Sarah"],"locations":["studio"],"products":["Sunrise Flow package"],"key_phrases":["transformed my stiff back","worth every penny"]}','positive',ARRAY['instructor quality','studio cleanliness','back pain relief'],ARRAY['Sunrise Flow package'],ARRAY['Sarah']),
      ('The online booking system crashed twice and I lost my spot. Very frustrating experience. The class itself was okay but the app needs serious work.','{"issues":["booking system","app"],"sentiment_triggers":["crashed","frustrating","serious work"]}','negative',ARRAY['booking system','technology','user experience'],ARRAY[],ARRAY[]),
      ('Mike was a bit rushed during the advanced session. I wanted more detailed alignment cues. The music was too loud. But the studio location is perfect.','{"people":["Mike"],"issues":["pacing","music volume"],"positives":["studio location"]}','mixed',ARRAY['instructor pacing','music','location','alignment'],ARRAY[],ARRAY['Mike']),
      ('Gift card purchase was seamless! Bought for my mother and she loves the beginner classes. Instructor Jennifer is patient and encouraging.','{"people":["Jennifer"],"products":["gift card","beginner classes"],"sentiment_triggers":["seamless","loves","patient","encouraging"]}','positive',ARRAY['gift cards','beginner classes','instructor quality'],ARRAY['gift card','beginner classes'],ARRAY['Jennifer']),
      ('Cancelled my membership due to scheduling issues. The times never worked for my work schedule. Please add evening classes after 7pm.','{"issues":["scheduling","timing"],"requests":["evening classes after 7pm"]}','negative',ARRAY['scheduling','membership','class times'],ARRAY['membership'],ARRAY[])
    `);
    await client.query(`INSERT INTO complaint_classifications (complaint_text, category, subcategory, priority, sentiment_score, escalation_required, suggested_response) VALUES
      ('The app keeps crashing when I try to book. I lost my reservation twice this week!','Technology','Booking System Bug','high',-0.8,false,'We sincerely apologize for the booking system issues you experienced. Our tech team has been notified and we are investigating the root cause. We have reserved your preferred slot manually and will credit your account with a complimentary class.'),
      ('Your instructor Mike was rude and dismissive when I asked for help with a pose. This is unacceptable.','Staff','Instructor Conduct','urgent',-0.95,true,'We take your feedback very seriously and want to make this right immediately. This falls short of our standards. A manager will reach out within 24 hours to discuss your experience and how we can make it right.'),
      ('I was charged twice for the same class! Please refund me immediately.','Billing','Duplicate Charge','urgent',-0.9,false,'We can see the double charge on our end and sincerely apologize. A full refund of the duplicate charge has been initiated and will appear in 3-5 business days. We will also add a complimentary class to your account.'),
      ('The locker room was not clean. There were wet towels on the floor and the showers smelled.','Facility','Hygiene','medium',-0.6,false,'Thank you for bringing this to our attention. We hold ourselves to the highest cleanliness standards. This has been escalated to our facilities team for immediate remediation. We apologize for the experience.'),
      ('My online class had buffering issues for the entire session. The instructor could not see me either.','Technology','Streaming Quality','medium',-0.65,false,'We apologize for the streaming difficulties during your class. We have logged this technical issue and our team is investigating. You will receive a complimentary class credit valid for 60 days.'),
      ('I signed up for the annual plan but was given monthly pricing. This feels deceptive.','Billing','Pricing Discrepancy','high',-0.75,true,'We sincerely apologize for the pricing confusion during signup. This is not the experience we want to provide. A billing specialist will review your account today and apply the annual plan pricing retroactively.')
    `);
    await client.query(`INSERT INTO legal_escalations (review_id, platform, content_excerpt, reason, status, assigned_to) VALUES
      ('yelp_review_4821','Yelp','This business is running a SCAM. They charged my card 5 times and refuse to refund','Defamatory false claims + potential fraud allegation','under_review','Legal Team'),
      ('google_review_9934','Google Business','The instructor physically touched me without consent during class adjustment','Serious safety and consent allegation requiring immediate investigation','investigating','HR & Legal'),
      ('tripadvisor_22810','TripAdvisor','HEALTH CODE VIOLATIONS - I found mold in the changing rooms. Report filed with city.','Public health claim — requires facility audit + legal response','resolved','Facilities Manager')
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
    const [entities, stats] = await Promise.all([
      client.query('SELECT * FROM review_entities ORDER BY created_at DESC'),
      client.query(`SELECT COUNT(*) as total,
        ROUND(AVG(jsonb_array_length(CASE WHEN jsonb_typeof(entities)='object' THEN '[]'::jsonb ELSE entities END)),1) as avg_entities
        FROM review_entities`),
    ]);
    return Response.json({ entities: entities.rows, stats: stats.rows[0] });
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
      `INSERT INTO review_entities (review_text, entities, sentiment, topics, products_mentioned, staff_mentioned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.review_text, JSON.stringify(body.entities || {}), body.sentiment, body.topics || [], body.products_mentioned || [], body.staff_mentioned || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}

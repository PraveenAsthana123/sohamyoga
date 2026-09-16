export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision() {
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS outbound_sequences (
      id SERIAL PRIMARY KEY, name TEXT, type TEXT, steps JSONB,
      status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS outbound_contacts (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT, company TEXT,
      sequence_id INTEGER, step_index INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', last_sent TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS outbound_messages (
      id SERIAL PRIMARY KEY, contact_id INTEGER, step INTEGER, channel TEXT,
      subject TEXT, body TEXT, status TEXT DEFAULT 'draft',
      sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS conversational_ai_config (
      id SERIAL PRIMARY KEY, name TEXT, persona TEXT, instructions TEXT,
      channels TEXT[], status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW())`);

    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM outbound_sequences');
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`INSERT INTO outbound_sequences (name,type,steps,status) VALUES
        ('Enterprise Cold Outreach','email',
         '[{"step":1,"day":0,"channel":"email","subject":"Quick question about {company}","body":"Hi {name}, I noticed {company} is scaling fast. We help companies like yours streamline their marketing operations. Worth a 15-min call?"},{"step":2,"day":3,"channel":"linkedin","subject":"Follow-up connection","body":"Hey {name}, sent you an email earlier. Would love to connect and share how we helped similar companies in {industry}."},{"step":3,"day":7,"channel":"email","subject":"Last thought for {name}","body":"Hi {name}, this will be my last reach out. If the timing is not right, no worries. Here is a quick case study that might be relevant to {company}..."}]',
         'active'),
        ('SMB LinkedIn Sequence','linkedin',
         '[{"step":1,"day":0,"channel":"linkedin","subject":"Connection request","body":"Hi {name}, I help {industry} companies grow with smart marketing automation. Would love to connect!"},{"step":2,"day":2,"channel":"linkedin","subject":"Value share","body":"Thanks for connecting {name}! Here is something that might help {company}: [resource link]"},{"step":3,"day":5,"channel":"email","subject":"From LinkedIn — quick intro","body":"Hey {name}, we connected on LinkedIn. I help companies like {company} achieve [outcome]. Open to a quick chat?"}]',
         'active'),
        ('Re-engagement Campaign','email',
         '[{"step":1,"day":0,"channel":"email","subject":"We miss you, {name}","body":"Hi {name}, it has been a while! We have launched some exciting new features that would help {company}. Worth catching up?"},{"step":2,"day":4,"channel":"email","subject":"Special offer for {company}","body":"Hi {name}, as a returning customer, we are offering you an exclusive 20% discount. Valid for 7 days."},{"step":3,"day":8,"channel":"sms","subject":"Last chance","body":"Hi {name}, your exclusive offer expires tomorrow. Reply YES to claim."}]',
         'paused')`);

      const seqRes = await client.query('SELECT id FROM outbound_sequences LIMIT 2');
      const seq1 = seqRes.rows[0]?.id || 1;
      const seq2 = seqRes.rows[1]?.id || 2;
      await client.query(`INSERT INTO outbound_contacts (name,email,company,sequence_id,step_index,status) VALUES
        ('Alex Turner','alex@techstartup.io','TechStartup.io',$1,1,'active'),
        ('Beth Sanders','beth@growthco.com','GrowthCo',$1,2,'active'),
        ('Chris Park','chris@innovatelabs.com','InnovateLabs',$1,3,'completed'),
        ('Diana West','diana@scalehq.com','ScaleHQ',$2,0,'active'),
        ('Evan Moore','evan@digitalfirst.io','DigitalFirst.io',$2,1,'active'),
        ('Fiona Clark','fiona@b2bsolutions.com','B2BSolutions',$1,0,'active'),
        ('George Hill','george@marketpro.com','MarketPro',$2,2,'active'),
        ('Hannah Scott','hannah@cloudventures.io','CloudVentures',$1,1,'paused'),
        ('Ian Foster','ian@saletech.com','SaleTech',$2,0,'active'),
        ('Julia King','julia@highgrowth.co','HighGrowth.co',$1,2,'active')`,
        [seq1, seq2]);

      await client.query(`INSERT INTO conversational_ai_config (name,persona,instructions,channels,status) VALUES
        ('Sales Qualifier Bot','You are a friendly, knowledgeable sales representative named Alex.',
         'Ask qualifying questions to understand the prospect prospect needs. Focus on budget, timeline, and pain points. Never hard sell. Collect contact info at the end.',
         ARRAY['website_chat','whatsapp'],'active'),
        ('Support & Upsell Bot','You are a helpful customer success specialist named Sam.',
         'Help existing customers solve problems. Identify opportunities for upgrades or complementary products. Be empathetic and solutions-focused.',
         ARRAY['website_chat','email'],'active')`);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const sequences = await client.query('SELECT * FROM outbound_sequences ORDER BY created_at DESC');
    const contacts = await client.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status=\'active\') AS active, COUNT(*) FILTER (WHERE status=\'completed\') AS completed FROM outbound_contacts');
    const messages = await client.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status=\'sent\') AS sent FROM outbound_messages');
    return Response.json({ sequences: sequences.rows, contactStats: contacts.rows[0], messageStats: messages.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.name) return Response.json({ error: 'name required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO outbound_sequences (name,type,steps,status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.name, b.type || 'email', JSON.stringify(b.steps || []), b.status || 'active']
    );
    return Response.json({ sequence: rows[0] }, { status: 201 });
  } finally { client.release(); }
}

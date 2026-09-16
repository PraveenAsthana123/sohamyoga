export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS lead_management_leads (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      score INTEGER DEFAULT 0,
      icp_fit TEXT,
      enrichment_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS lead_management_icp (
      id SERIAL PRIMARY KEY,
      name TEXT,
      industry TEXT,
      company_size TEXT,
      pain_points TEXT[],
      buying_signals TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS lead_management_nurture_sequences (
      id SERIAL PRIMARY KEY,
      name TEXT,
      steps JSONB,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    // Seed demo data if empty
    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM lead_management_leads');
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`INSERT INTO lead_management_leads (name,email,phone,company,source,status,score,icp_fit,enrichment_data) VALUES
        ('Alice Johnson','alice@techcorp.com','+1-555-1001','TechCorp','website','new',72,'strong','{"industry":"SaaS","company_size":"50-200","linkedin":"alice-johnson"}'),
        ('Bob Martinez','bob@retailplus.com','+1-555-1002','RetailPlus','linkedin','qualified',85,'strong','{"industry":"Retail","company_size":"200-500","linkedin":"bob-martinez"}'),
        ('Carol White','carol@healthco.com','+1-555-1003','HealthCo','referral','nurturing',60,'medium','{"industry":"Healthcare","company_size":"10-50","linkedin":"carol-white"}'),
        ('David Kim','david@fintech.io','+1-555-1004','FinTech.io','cold_outreach','new',45,'weak','{"industry":"Finance","company_size":"1-10","linkedin":"david-kim"}'),
        ('Emma Davis','emma@logisticshub.com','+1-555-1005','LogisticsHub','webinar','qualified',90,'strong','{"industry":"Logistics","company_size":"500+","linkedin":"emma-davis"}'),
        ('Frank Lee','frank@edutrain.com','+1-555-1006','EduTrain','email_campaign','new',30,'weak','{"industry":"Education","company_size":"10-50","linkedin":"frank-lee"}'),
        ('Grace Chen','grace@manufactureco.com','+1-555-1007','ManufactureCo','trade_show','nurturing',65,'medium','{"industry":"Manufacturing","company_size":"200-500","linkedin":"grace-chen"}'),
        ('Henry Brown','henry@cloudsoft.io','+1-555-1008','CloudSoft.io','website','converted',95,'strong','{"industry":"SaaS","company_size":"50-200","linkedin":"henry-brown"}'),
        ('Iris Wilson','iris@mediapro.com','+1-555-1009','MediaPro','linkedin','new',50,'medium','{"industry":"Media","company_size":"1-10","linkedin":"iris-wilson"}'),
        ('James Taylor','james@consulting360.com','+1-555-1010','Consulting360','referral','qualified',78,'strong','{"industry":"Consulting","company_size":"10-50","linkedin":"james-taylor"}'),
        ('Karen Moore','karen@realtybig.com','+1-555-1011','RealtyBig','cold_outreach','new',22,'weak','{"industry":"Real Estate","company_size":"1-10","linkedin":"karen-moore"}'),
        ('Liam Anderson','liam@agritech.io','+1-555-1012','AgriTech.io','webinar','nurturing',55,'medium','{"industry":"Agriculture","company_size":"10-50","linkedin":"liam-anderson"}'),
        ('Maya Patel','maya@insuranceco.com','+1-555-1013','InsuranceCo','email_campaign','qualified',82,'strong','{"industry":"Insurance","company_size":"200-500","linkedin":"maya-patel"}'),
        ('Noah Garcia','noah@legalfirm.com','+1-555-1014','LegalFirm','website','new',40,'weak','{"industry":"Legal","company_size":"1-10","linkedin":"noah-garcia"}'),
        ('Olivia Robinson','olivia@enterprise360.com','+1-555-1015','Enterprise360','linkedin','converted',88,'strong','{"industry":"SaaS","company_size":"500+","linkedin":"olivia-robinson"}')`);
      await client.query(`INSERT INTO lead_management_icp (name,industry,company_size,pain_points,buying_signals) VALUES
        ('Enterprise SaaS ICP','SaaS','50-500',ARRAY['scalability','integration complexity','team collaboration'],ARRAY['evaluating tools','budget approved','demo requested']),
        ('SMB Retail ICP','Retail','10-100',ARRAY['inventory management','customer retention','online presence'],ARRAY['competitor comparison','free trial interest','webinar attended'])`);
      await client.query(`INSERT INTO lead_management_nurture_sequences (name,steps,status) VALUES
        ('Enterprise Onboarding',
         '[{"step":1,"day":1,"channel":"email","subject":"Welcome to our ecosystem","body":"Hi {name}, thanks for your interest in our platform..."},{"step":2,"day":3,"channel":"linkedin","subject":"Value prop follow-up","body":"Hey {name}, just wanted to share how {company} could benefit..."},{"step":3,"day":7,"channel":"email","subject":"Free demo offer","body":"Hi {name}, we would love to show you a personalized demo..."}]',
         'active'),
        ('SMB Quick Win',
         '[{"step":1,"day":1,"channel":"email","subject":"Quick wins for {company}","body":"Hello {name}, we help companies like {company} achieve results fast..."},{"step":2,"day":2,"channel":"sms","subject":"Follow-up","body":"Hi {name}, just checking in from our team..."},{"step":3,"day":5,"channel":"email","subject":"Case study share","body":"Hi {name}, here is a case study relevant to {company}..."}]',
         'active')`);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const source = url.searchParams.get('source');
    const minScore = url.searchParams.get('minScore');
    const maxScore = url.searchParams.get('maxScore');
    const search = url.searchParams.get('search');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (source) { params.push(source); conditions.push(`source = $${params.length}`); }
    if (minScore) { params.push(parseInt(minScore)); conditions.push(`score >= $${params.length}`); }
    if (maxScore) { params.push(parseInt(maxScore)); conditions.push(`score <= $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const leads = await client.query(`SELECT * FROM lead_management_leads ${where} ORDER BY created_at DESC LIMIT 200`, params);
    const metrics = await client.query(`SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status='new') as new_leads,
      COUNT(*) FILTER (WHERE status='qualified') as qualified,
      COUNT(*) FILTER (WHERE status='nurturing') as nurturing,
      COUNT(*) FILTER (WHERE status='converted') as converted,
      ROUND(AVG(score),1) as avg_score
      FROM lead_management_leads`);
    return Response.json({ leads: leads.rows, metrics: metrics.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.name || !b.email) return Response.json({ error: 'name and email required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO lead_management_leads (name,email,phone,company,source,status,score,icp_fit,enrichment_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.name, b.email, b.phone || null, b.company || null, b.source || 'manual', b.status || 'new', b.score || 0, b.icp_fit || null, b.enrichment_data ? JSON.stringify(b.enrichment_data) : null]
    );
    return Response.json({ lead: rows[0] }, { status: 201 });
  } finally { client.release(); }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS risk_register (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    description TEXT,
    likelihood INTEGER DEFAULT 3,
    impact INTEGER DEFAULT 3,
    risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
    owner TEXT,
    controls TEXT[],
    status TEXT DEFAULT 'open',
    treatment TEXT DEFAULT 'mitigate',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS third_party_risks (
    id SERIAL PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    service TEXT,
    data_shared TEXT[],
    criticality TEXT DEFAULT 'medium',
    last_assessment DATE,
    risk_level TEXT DEFAULT 'medium',
    findings TEXT[],
    next_review DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS compliance_walkthroughs (
    id SERIAL PRIMARY KEY,
    process_name TEXT NOT NULL,
    control_owner TEXT,
    walkthrough_date DATE,
    tester TEXT,
    steps JSONB,
    findings TEXT[],
    result TEXT DEFAULT 'pass',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS audit_samples (
    id SERIAL PRIMARY KEY,
    population_name TEXT NOT NULL,
    population_size INTEGER DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    method TEXT DEFAULT 'random',
    items_sampled JSONB,
    exceptions_found INTEGER DEFAULT 0,
    exception_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function seed(client: import('pg').PoolClient) {
  const { rowCount } = await client.query('SELECT 1 FROM risk_register LIMIT 1');
  if (rowCount && rowCount > 0) return;
  await client.query(`INSERT INTO risk_register (title,category,description,likelihood,impact,owner,controls,status,treatment) VALUES
    ('Ransomware Attack on Core Systems','Cyber','Malicious encryption of production databases and backups',3,5,'CISO','{"Endpoint detection","Offline backups","Incident response plan"}','open','mitigate'),
    ('ERP System Downtime','Technology','Extended outage of ERP system affecting order processing',2,4,'IT Director','{"Redundant hosting","DR plan","Maintenance windows"}','open','mitigate'),
    ('Key Employee Departure','Operational','Loss of critical institutional knowledge in finance function',4,3,'HR Director','{"Knowledge documentation","Cross-training","Succession planning"}','open','accept'),
    ('GDPR Non-Compliance','Privacy','Failure to comply with EU data protection requirements',2,5,'DPO','{"Privacy impact assessments","Data mapping","Consent management"}','in-progress','mitigate'),
    ('Vendor Financial Instability','Third-Party','Key payment processor enters bankruptcy',1,4,'Procurement','{"Vendor financial monitoring","Alternative vendor ready","Contract exit clauses"}','open','transfer'),
    ('Cloud Provider Outage','Technology','Extended AWS/GCP downtime affecting SaaS services',2,4,'CTO','{"Multi-cloud strategy","CDN failover","Status monitoring"}','open','mitigate'),
    ('Phishing Attack on Staff','Cyber','Credential theft through targeted phishing campaigns',4,4,'CISO','{"Security awareness training","MFA enforcement","Email filtering"}','open','mitigate'),
    ('Process Manual Error Rate','Operational','High error rate in manual data entry causing financial misstatements',3,3,'Operations Manager','{"Automated validation","Dual-control","Regular audits"}','open','mitigate'),
    ('Third-Party Data Breach','Third-Party','Vendor breach exposes shared customer data',2,5,'Legal','{"Vendor security assessments","DPA agreements","Data minimization"}','open','transfer'),
    ('Privacy Consent Gaps','Privacy','Missing or invalid consent records for marketing communications',3,3,'Marketing Ops','{"Consent audit","CMP implementation","Preference center"}','in-progress','mitigate')`);
  await client.query(`INSERT INTO third_party_risks (vendor_name,service,data_shared,criticality,last_assessment,risk_level,findings,next_review) VALUES
    ('Stripe','Payment Processing','{"card_numbers","billing_address","transaction_history"}','critical','2024-06-01','low','{"SOC2 Type II certified","PCI DSS compliant"}','2025-06-01'),
    ('Salesforce','CRM Platform','{"customer_names","emails","deal_data"}','high','2024-08-15','medium','{"MFA not enforced for all users","API rate limits not configured"}','2025-02-15'),
    ('AWS','Cloud Infrastructure','{"all_application_data","logs","backups"}','critical','2024-09-01','low','{"ISO 27001 certified","Shared responsibility model documented"}','2025-09-01'),
    ('HubSpot','Marketing Automation','{"email_addresses","behavioral_data","campaign_performance"}','medium','2024-07-20','medium','{"Data retention policy unclear","Sub-processors not fully documented"}','2025-01-20')`);
  await client.query(`INSERT INTO compliance_walkthroughs (process_name,control_owner,walkthrough_date,tester,steps,findings,result) VALUES
    ('Invoice Approval Control','Finance Manager','2024-09-01','Internal Audit','[{"step":1,"description":"Verify invoice received","evidence":"Email log"},{"step":2,"description":"Match PO to invoice","evidence":"ERP screenshot"},{"step":3,"description":"Manager approval","evidence":"Approval workflow"}]','{}','pass'),
    ('Access Provisioning Review','IT Security','2024-08-15','External Auditor','[{"step":1,"description":"Check new user request form","evidence":"Ticket log"},{"step":2,"description":"Verify manager approval","evidence":"Email"},{"step":3,"description":"Review provisioned access","evidence":"AD export"}]','{"2 users provisioned without documented manager approval"}','fail'),
    ('Data Backup Verification','IT Operations','2024-09-10','Internal Audit','[{"step":1,"description":"Review backup schedule","evidence":"Cron logs"},{"step":2,"description":"Test restore","evidence":"Restore test report"},{"step":3,"description":"Verify offsite copy","evidence":"S3 bucket policy"}]','{}','pass')`);
  await client.query(`INSERT INTO audit_samples (population_name,population_size,sample_size,method,items_sampled,exceptions_found,exception_rate) VALUES
    ('Q3 Invoices Over $10K',342,59,'random','[{"invoice":"INV-2024-1021","amount":15400,"approved":true},{"invoice":"INV-2024-1034","amount":22100,"approved":true}]',2,3.4),
    ('Employee Expense Reports - Q3',1247,93,'stratified','[{"report":"EXP-2024-0441","amount":850,"compliant":true},{"report":"EXP-2024-0512","amount":1200,"compliant":false}]',7,7.5)`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    await seed(client);
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (category) { conditions.push(`category=$${params.length + 1}`); params.push(category); }
    if (status) { conditions.push(`status=$${params.length + 1}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const risks = await client.query(`SELECT * FROM risk_register ${where} ORDER BY risk_score DESC`, params);
    return Response.json({ risks: risks.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.title) return Response.json({ error: 'title required' }, { status: 400 });
  const lh = Math.min(5, Math.max(1, parseInt(body.likelihood) || 3));
  const imp = Math.min(5, Math.max(1, parseInt(body.impact) || 3));
  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    const r = await client.query(
      `INSERT INTO risk_register (title,category,description,likelihood,impact,owner,controls,status,treatment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.title, body.category || null, body.description || null,
       lh, imp, body.owner || null,
       body.controls || [], body.status || 'open', body.treatment || 'mitigate']
    );
    return Response.json({ risk: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}

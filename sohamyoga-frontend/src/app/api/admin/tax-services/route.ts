import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { OLLAMA_URL, OLLAMA_MODEL } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tax_client (
      id SERIAL PRIMARY KEY,
      client_type TEXT NOT NULL DEFAULT 'personal',
      name TEXT NOT NULL,
      sin TEXT,
      bn TEXT,
      email TEXT, phone TEXT,
      address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', postal_code TEXT,
      date_of_birth DATE, marital_status TEXT, num_dependants INT DEFAULT 0,
      employment_type TEXT,
      corporation_name TEXT, fiscal_year_end DATE, incorporated_date DATE, industry TEXT,
      num_employees INT DEFAULT 0,
      does_t1 BOOLEAN DEFAULT false, does_t2 BOOLEAN DEFAULT false,
      does_gst BOOLEAN DEFAULT false, gst_filing_frequency TEXT,
      does_payroll BOOLEAN DEFAULT false, payroll_frequency TEXT,
      does_bookkeeping BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active',
      referral_source TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tax_return (
      id SERIAL PRIMARY KEY,
      client_id INT REFERENCES tax_client(id) ON DELETE CASCADE,
      return_type TEXT NOT NULL,
      tax_year INT,
      period_start DATE, period_end DATE,
      status TEXT DEFAULT 'not_started',
      documents_received BOOLEAN DEFAULT false,
      assigned_to TEXT DEFAULT 'preparer',
      revenue NUMERIC(12,2), expenses NUMERIC(12,2),
      net_income NUMERIC(12,2), taxable_income NUMERIC(12,2),
      federal_tax NUMERIC(10,2), provincial_tax NUMERIC(10,2),
      total_tax_owing NUMERIC(10,2), refund_amount NUMERIC(10,2),
      gst_collected NUMERIC(10,2), gst_paid NUMERIC(10,2), gst_net NUMERIC(10,2),
      service_fee NUMERIC(8,2), invoiced_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
      filed_date DATE, confirmation_number TEXT, netfile_access_code TEXT,
      due_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tax_document (
      id SERIAL PRIMARY KEY,
      return_id INT REFERENCES tax_return(id) ON DELETE CASCADE,
      document_name TEXT NOT NULL,
      document_type TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tax_deadline (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      deadline_date DATE NOT NULL,
      return_type TEXT,
      description TEXT,
      is_recurring BOOLEAN DEFAULT true,
      recurring_pattern TEXT
    );
  `);

  // Seed deadlines if empty (using current year as anchor)
  const existing = await client.query('SELECT COUNT(*) AS cnt FROM tax_deadline');
  if (parseInt(existing.rows[0].cnt) === 0) {
    const yr = new Date().getFullYear();
    const seeds = [
      { name: 'T1 Personal — Balance Due', deadline_date: `${yr}-04-30`, return_type: 'T1', description: 'Balance owing due April 30 for all personal tax returns', recurring_pattern: 'annual' },
      { name: 'T1 Personal — Filing Deadline', deadline_date: `${yr}-04-30`, return_type: 'T1', description: 'Filing deadline for most personal tax returns (T1 General)', recurring_pattern: 'annual' },
      { name: 'T1 Self-Employed — Filing Deadline', deadline_date: `${yr}-06-15`, return_type: 'T1', description: 'Filing deadline for self-employed individuals. NOTE: balance still due April 30.', recurring_pattern: 'annual' },
      { name: 'T4/T4A Slips — Employer Deadline', deadline_date: `${yr}-02-28`, return_type: 'T4', description: 'Employers must file T4 and T4A slips with CRA and provide to employees by Feb 28', recurring_pattern: 'annual' },
      { name: 'T5 Slips — Investment Income', deadline_date: `${yr}-02-28`, return_type: 'T5', description: 'T5 investment income slips due to CRA and recipients by Feb 28', recurring_pattern: 'annual' },
      { name: 'GST/HST Quarterly — Q1 (Jan–Mar)', deadline_date: `${yr}-04-30`, return_type: 'GST_HST', description: 'GST/HST quarterly filers: Q1 return due April 30', recurring_pattern: 'quarterly' },
      { name: 'GST/HST Quarterly — Q2 (Apr–Jun)', deadline_date: `${yr}-07-31`, return_type: 'GST_HST', description: 'GST/HST quarterly filers: Q2 return due July 31', recurring_pattern: 'quarterly' },
      { name: 'GST/HST Quarterly — Q3 (Jul–Sep)', deadline_date: `${yr}-10-31`, return_type: 'GST_HST', description: 'GST/HST quarterly filers: Q3 return due October 31', recurring_pattern: 'quarterly' },
      { name: 'GST/HST Quarterly — Q4 (Oct–Dec)', deadline_date: `${yr+1}-01-31`, return_type: 'GST_HST', description: 'GST/HST quarterly filers: Q4 return due January 31 of following year', recurring_pattern: 'quarterly' },
      { name: 'Payroll Remittance — Regular (Jan)', deadline_date: `${yr}-02-15`, return_type: 'payroll', description: 'Regular remitters: January payroll remittance due Feb 15', recurring_pattern: 'monthly' },
      { name: 'Corporate Tax Installment — Q1', deadline_date: `${yr}-03-31`, return_type: 'T2', description: 'Quarterly corporate installment for Dec 31 fiscal year end corps', recurring_pattern: 'quarterly' },
      { name: 'Corporate Tax Installment — Q2', deadline_date: `${yr}-06-30`, return_type: 'T2', description: 'Quarterly corporate installment for Dec 31 fiscal year end corps', recurring_pattern: 'quarterly' },
      { name: 'Corporate Tax Installment — Q3', deadline_date: `${yr}-09-30`, return_type: 'T2', description: 'Quarterly corporate installment for Dec 31 fiscal year end corps', recurring_pattern: 'quarterly' },
      { name: 'T2 Corporate Return (Dec 31 FYE)', deadline_date: `${yr}-06-30`, return_type: 'T2', description: 'T2 return for Dec 31 fiscal year end: due 6 months after FYE (June 30)', recurring_pattern: 'annual' },
    ];
    for (const s of seeds) {
      await client.query(
        `INSERT INTO tax_deadline (name,deadline_date,return_type,description,recurring_pattern)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [s.name, s.deadline_date, s.return_type, s.description, s.recurring_pattern]
      );
    }
  }
}

// ─── Ollama helper ────────────────────────────────────────────────────────────
async function ollamaChat(prompt: string, systemMsg: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.3, num_predict: 1024 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json() as { message?: { content?: string } };
    return data?.message?.content?.trim() ?? '';
  } catch {
    return 'AI advisor temporarily unavailable. Please try again shortly.';
  } finally {
    clearTimeout(t);
  }
}

// ─── Route dispatcher ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await access(req); if (auth.denied) return auth.denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const url = new URL(req.url);
    const seg = url.pathname.replace(/.*\/tax-services\/?/, '').split('/').filter(Boolean);

    // GET /api/admin/tax-services/stats
    if (seg[0] === 'stats' || seg.length === 0) {
      const [returnStats, clientStats, revenue, overdue] = await Promise.all([
        client.query(`
          SELECT return_type, status, COUNT(*) AS cnt
          FROM tax_return GROUP BY return_type, status
        `),
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE does_t1) AS t1_clients,
            COUNT(*) FILTER (WHERE does_t2) AS t2_clients,
            COUNT(*) FILTER (WHERE does_gst) AS gst_clients,
            COUNT(*) FILTER (WHERE does_payroll) AS payroll_clients,
            COUNT(*) FILTER (WHERE does_bookkeeping) AS bookkeeping_clients,
            COUNT(*) AS total
          FROM tax_client WHERE status='active'
        `),
        client.query(`
          SELECT
            COALESCE(SUM(service_fee) FILTER (WHERE DATE_TRUNC('month',created_at)=DATE_TRUNC('month',NOW())), 0) AS revenue_this_month,
            COALESCE(SUM(service_fee) FILTER (WHERE paid_at IS NULL AND status='filed'), 0) AS outstanding
          FROM tax_return
        `),
        client.query(`
          SELECT r.id, r.return_type, r.tax_year, r.due_date, r.status, c.name AS client_name
          FROM tax_return r JOIN tax_client c ON c.id=r.client_id
          WHERE r.status != 'filed' AND r.due_date IS NOT NULL AND r.due_date < NOW()
          ORDER BY r.due_date ASC LIMIT 20
        `),
      ]);
      return Response.json({
        return_stats: returnStats.rows,
        client_stats: clientStats.rows[0],
        revenue: revenue.rows[0],
        overdue_returns: overdue.rows,
      });
    }

    // GET /api/admin/tax-services/clients
    if (seg[0] === 'clients' && seg.length === 1) {
      const type = url.searchParams.get('client_type');
      const status = url.searchParams.get('status');
      let q = 'SELECT * FROM tax_client';
      const params: unknown[] = [];
      const conds: string[] = [];
      if (type) { params.push(type); conds.push(`client_type=$${params.length}`); }
      if (status) { params.push(status); conds.push(`status=$${params.length}`); }
      if (conds.length) q += ' WHERE ' + conds.join(' AND ');
      q += ' ORDER BY created_at DESC LIMIT 300';
      const r = await client.query(q, params);
      return Response.json({ clients: r.rows });
    }

    // GET /api/admin/tax-services/clients/[id]
    if (seg[0] === 'clients' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const [cl, returns] = await Promise.all([
        client.query('SELECT * FROM tax_client WHERE id=$1', [id]),
        client.query('SELECT * FROM tax_return WHERE client_id=$1 ORDER BY created_at DESC', [id]),
      ]);
      if (!cl.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: cl.rows[0], returns: returns.rows });
    }

    // GET /api/admin/tax-services/returns
    if (seg[0] === 'returns' && seg.length === 1) {
      const type = url.searchParams.get('return_type');
      const status = url.searchParams.get('status');
      const year = url.searchParams.get('tax_year');
      const overdue = url.searchParams.get('overdue');
      let q = `SELECT r.*, c.name AS client_name, c.client_type FROM tax_return r JOIN tax_client c ON c.id=r.client_id`;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (type) { params.push(type); conds.push(`r.return_type=$${params.length}`); }
      if (status) { params.push(status); conds.push(`r.status=$${params.length}`); }
      if (year) { params.push(parseInt(year)); conds.push(`r.tax_year=$${params.length}`); }
      if (overdue === 'true') conds.push(`r.due_date < NOW() AND r.status != 'filed'`);
      if (conds.length) q += ' WHERE ' + conds.join(' AND ');
      q += ' ORDER BY r.due_date ASC NULLS LAST, r.created_at DESC LIMIT 300';
      const r = await client.query(q, params);
      return Response.json({ returns: r.rows });
    }

    // GET /api/admin/tax-services/returns/[id]
    if (seg[0] === 'returns' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const [ret, docs] = await Promise.all([
        client.query(`SELECT r.*, c.name AS client_name FROM tax_return r JOIN tax_client c ON c.id=r.client_id WHERE r.id=$1`, [id]),
        client.query('SELECT * FROM tax_document WHERE return_id=$1 ORDER BY created_at', [id]),
      ]);
      if (!ret.rowCount) return Response.json({ error: 'Return not found.' }, { status: 404 });
      return Response.json({ tax_return: ret.rows[0], documents: docs.rows });
    }

    // GET /api/admin/tax-services/returns/[id]/documents
    if (seg[0] === 'returns' && seg.length === 3 && seg[2] === 'documents') {
      const id = parseInt(seg[1]);
      const r = await client.query('SELECT * FROM tax_document WHERE return_id=$1 ORDER BY created_at', [id]);
      return Response.json({ documents: r.rows });
    }

    // GET /api/admin/tax-services/deadlines
    if (seg[0] === 'deadlines') {
      const days = parseInt(url.searchParams.get('days') ?? '90');
      const r = await client.query(`
        SELECT * FROM tax_deadline
        WHERE deadline_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
        ORDER BY deadline_date ASC LIMIT 50
      `);
      return Response.json({ deadlines: r.rows });
    }

    return Response.json({ error: 'Not found.' }, { status: 404 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await access(req); if (auth.denied) return auth.denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const url = new URL(req.url);
    const seg = url.pathname.replace(/.*\/tax-services\/?/, '').split('/').filter(Boolean);
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    // POST /api/admin/tax-services/clients
    if (seg[0] === 'clients' && seg.length === 1) {
      const { client_type, name, sin, bn, email, phone, address, city, province, postal_code,
              date_of_birth, marital_status, num_dependants, employment_type,
              corporation_name, fiscal_year_end, incorporated_date, industry, num_employees,
              does_t1, does_t2, does_gst, gst_filing_frequency, does_payroll, payroll_frequency,
              does_bookkeeping, status, referral_source, notes } = body;
      if (!name?.trim()) return Response.json({ error: 'Client name is required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO tax_client (client_type,name,sin,bn,email,phone,address,city,province,postal_code,
          date_of_birth,marital_status,num_dependants,employment_type,corporation_name,fiscal_year_end,
          incorporated_date,industry,num_employees,does_t1,does_t2,does_gst,gst_filing_frequency,
          does_payroll,payroll_frequency,does_bookkeeping,status,referral_source,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        RETURNING *`,
        [client_type||'personal',name.trim(),sin,bn,email,phone,address,
         city||'Calgary',province||'AB',postal_code,date_of_birth||null,marital_status,
         num_dependants||0,employment_type,corporation_name,fiscal_year_end||null,
         incorporated_date||null,industry,num_employees||0,
         does_t1||false,does_t2||false,does_gst||false,gst_filing_frequency,
         does_payroll||false,payroll_frequency,does_bookkeeping||false,
         status||'active',referral_source,notes]);
      return Response.json({ client: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/tax-services/returns
    if (seg[0] === 'returns' && seg.length === 1) {
      const { client_id, return_type, tax_year, period_start, period_end, status,
              assigned_to, service_fee, due_date, notes } = body;
      if (!client_id || !return_type?.trim()) return Response.json({ error: 'client_id and return_type required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO tax_return (client_id,return_type,tax_year,period_start,period_end,status,
          assigned_to,service_fee,due_date,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [client_id,return_type.trim(),tax_year||null,period_start||null,period_end||null,
         status||'not_started',assigned_to||'preparer',service_fee||null,due_date||null,notes]);
      return Response.json({ tax_return: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/tax-services/returns/[id]/documents
    if (seg[0] === 'returns' && seg.length === 3 && seg[2] === 'documents') {
      const ret_id = parseInt(seg[1]);
      const { document_name, document_type, status, notes } = body;
      if (!document_name?.trim()) return Response.json({ error: 'document_name required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO tax_document (return_id,document_name,document_type,status,notes)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [ret_id,document_name.trim(),document_type,status||'pending',notes]);
      return Response.json({ document: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/tax-services/returns/[id]/file
    if (seg[0] === 'returns' && seg.length === 3 && seg[2] === 'file') {
      const ret_id = parseInt(seg[1]);
      const { confirmation_number, netfile_access_code } = body;
      const r = await client.query(`
        UPDATE tax_return SET status='filed', filed_date=NOW()::DATE,
          confirmation_number=$2, netfile_access_code=$3
        WHERE id=$1 RETURNING *`,
        [ret_id, confirmation_number ?? null, netfile_access_code ?? null]);
      if (!r.rowCount) return Response.json({ error: 'Return not found.' }, { status: 404 });
      return Response.json({ tax_return: r.rows[0] });
    }

    // POST /api/admin/tax-services/ai-advisor
    if (seg[0] === 'ai-advisor') {
      const { return_type, situation_description } = body;
      if (!return_type) return Response.json({ error: 'return_type is required.' }, { status: 400 });
      const prompt = `Canadian tax advice request:
- Return type: ${return_type}
- Situation: ${situation_description ?? 'General guidance requested'}

Please provide:
1. Applicable deductions and credits for this return type
2. Common mistakes to avoid when filing this return
3. Relevant CRA programs, forms, or guides to reference
4. Filing tips and best practices
5. Any recent CRA changes relevant to this return type (as of 2024/2025 tax year)`;
      const result = await ollamaChat(prompt,
        'You are an expert Canadian tax professional with deep knowledge of CRA rules, T1/T2 returns, GST/HST, payroll, and tax planning. Provide practical, accurate guidance. Always recommend verification with a licensed CPA/CGA and the CRA website for official requirements.');
      return Response.json({ advice: result, return_type });
    }

    return Response.json({ error: 'Not found.' }, { status: 404 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await access(req); if (auth.denied) return auth.denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const url = new URL(req.url);
    const seg = url.pathname.replace(/.*\/tax-services\/?/, '').split('/').filter(Boolean);
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    // PUT /api/admin/tax-services/clients/[id]
    if (seg[0] === 'clients' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const fields = ['client_type','name','sin','bn','email','phone','address','city','province',
        'postal_code','date_of_birth','marital_status','num_dependants','employment_type',
        'corporation_name','fiscal_year_end','incorporated_date','industry','num_employees',
        'does_t1','does_t2','does_gst','gst_filing_frequency','does_payroll','payroll_frequency',
        'does_bookkeeping','status','referral_source','notes'];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { params.push(body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
      params.push(id);
      const r = await client.query(`UPDATE tax_client SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: r.rows[0] });
    }

    // PUT /api/admin/tax-services/returns/[id]
    if (seg[0] === 'returns' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const fields = ['return_type','tax_year','period_start','period_end','status','documents_received',
        'assigned_to','revenue','expenses','net_income','taxable_income','federal_tax','provincial_tax',
        'total_tax_owing','refund_amount','gst_collected','gst_paid','gst_net',
        'service_fee','invoiced_at','paid_at','filed_date','confirmation_number',
        'netfile_access_code','due_date','notes'];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { params.push(body[f]); sets.push(`${f}=$${params.length}`); }
      }
      // Mark paid
      if (body.mark_paid) { params.push(new Date().toISOString()); sets.push(`paid_at=$${params.length}`); }
      if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
      params.push(id);
      const r = await client.query(`UPDATE tax_return SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r.rowCount) return Response.json({ error: 'Return not found.' }, { status: 404 });
      return Response.json({ tax_return: r.rows[0] });
    }

    return Response.json({ error: 'Not found.' }, { status: 404 });
  } finally {
    client.release();
  }
}

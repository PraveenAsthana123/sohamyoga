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
    CREATE TABLE IF NOT EXISTS immigration_client (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, email TEXT, phone TEXT,
      nationality TEXT, country_of_birth TEXT,
      date_of_birth DATE, passport_number TEXT, passport_expiry DATE,
      current_country TEXT DEFAULT 'Canada', current_status TEXT,
      marital_status TEXT, num_dependants INT DEFAULT 0,
      education_level TEXT,
      noc_code TEXT, occupation TEXT,
      clb_english INT, clb_french INT,
      work_experience_years INT,
      canadian_work_experience_years INT DEFAULT 0,
      provincial_nomination BOOLEAN DEFAULT false, province_nominated TEXT,
      crs_score INT,
      source TEXT, referral_name TEXT,
      status TEXT DEFAULT 'prospect',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS immigration_application (
      id SERIAL PRIMARY KEY,
      client_id INT REFERENCES immigration_client(id) ON DELETE CASCADE,
      program_type TEXT NOT NULL,
      program_subtype TEXT,
      application_number TEXT,
      uci_number TEXT,
      submission_date DATE,
      decision_date DATE,
      status TEXT DEFAULT 'preparing',
      biometrics_required BOOLEAN DEFAULT false,
      biometrics_date DATE,
      medical_exam_required BOOLEAN DEFAULT false,
      medical_exam_date DATE,
      ircc_fee NUMERIC(8,2),
      consultant_fee NUMERIC(8,2),
      notes TEXT,
      timeline_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS immigration_document (
      id SERIAL PRIMARY KEY,
      application_id INT REFERENCES immigration_application(id) ON DELETE CASCADE,
      document_name TEXT NOT NULL,
      document_type TEXT,
      status TEXT DEFAULT 'pending',
      expiry_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS immigration_task (
      id SERIAL PRIMARY KEY,
      application_id INT REFERENCES immigration_application(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT,
      due_date DATE, completed_at TIMESTAMPTZ,
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT DEFAULT 'consultant',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
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
        options: { temperature: 0.4, num_predict: 1024 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json() as { message?: { content?: string } };
    return data?.message?.content?.trim() ?? '';
  } catch {
    return 'AI analysis temporarily unavailable. Please try again shortly.';
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
    const seg = url.pathname.replace(/.*\/immigration-consultant\/?/, '').split('/').filter(Boolean);

    // GET /api/admin/immigration-consultant → stats dashboard
    if (seg.length === 0) {
      const [clientStats, appStats, deadlines] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status='active') AS active,
            jsonb_object_agg(status, cnt) AS by_status
          FROM (SELECT status, COUNT(*) AS cnt FROM immigration_client GROUP BY status) s
        `),
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE status='preparing') AS preparing,
            COUNT(*) FILTER (WHERE status='submitted') AS submitted,
            COUNT(*) FILTER (WHERE status='approved') AS approved,
            COUNT(*) FILTER (WHERE status='refused') AS refused,
            COUNT(*) FILTER (WHERE status='in_review') AS in_review
          FROM immigration_application
        `),
        client.query(`
          SELECT t.id, t.title, t.due_date, t.priority, t.status,
                 a.program_type, c.name AS client_name
          FROM immigration_task t
          JOIN immigration_application a ON a.id = t.application_id
          JOIN immigration_client c ON c.id = a.client_id
          WHERE t.status != 'completed' AND t.due_date <= NOW() + INTERVAL '14 days'
          ORDER BY t.due_date ASC LIMIT 20
        `),
      ]);
      return Response.json({
        clients: clientStats.rows[0],
        applications: appStats.rows[0],
        upcoming_deadlines: deadlines.rows,
        processing_times_note: {
          express_entry: '~6 months (general estimate)',
          study_permit: '~8 weeks (general estimate)',
          work_permit: 'Varies by type (weeks to months)',
          visitor_visa: 'A few weeks (general estimate)',
          note: 'These are general IRCC estimates only. Actual times vary.',
        },
      });
    }

    // GET /api/admin/immigration-consultant/clients
    if (seg[0] === 'clients' && seg.length === 1) {
      const status = url.searchParams.get('status');
      const nationality = url.searchParams.get('nationality');
      let q = `SELECT c.*, COUNT(a.id) AS application_count
               FROM immigration_client c
               LEFT JOIN immigration_application a ON a.client_id = c.id`;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status) { params.push(status); conds.push(`c.status=$${params.length}`); }
      if (nationality) { params.push(nationality); conds.push(`c.nationality=$${params.length}`); }
      if (conds.length) q += ' WHERE ' + conds.join(' AND ');
      q += ' GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200';
      const r = await client.query(q, params);
      return Response.json({ clients: r.rows });
    }

    // GET /api/admin/immigration-consultant/clients/[id]
    if (seg[0] === 'clients' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const [cl, apps] = await Promise.all([
        client.query('SELECT * FROM immigration_client WHERE id=$1', [id]),
        client.query(`
          SELECT a.*,
            (SELECT json_agg(d) FROM immigration_document d WHERE d.application_id=a.id) AS documents,
            (SELECT json_agg(t) FROM immigration_task t WHERE t.application_id=a.id) AS tasks
          FROM immigration_application a WHERE a.client_id=$1 ORDER BY a.created_at DESC
        `, [id]),
      ]);
      if (!cl.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: cl.rows[0], applications: apps.rows });
    }

    // GET /api/admin/immigration-consultant/applications
    if (seg[0] === 'applications' && seg.length === 1) {
      const prog = url.searchParams.get('program_type');
      const status = url.searchParams.get('status');
      let q = `SELECT a.*, c.name AS client_name, c.nationality
               FROM immigration_application a JOIN immigration_client c ON c.id=a.client_id`;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (prog) { params.push(prog); conds.push(`a.program_type=$${params.length}`); }
      if (status) { params.push(status); conds.push(`a.status=$${params.length}`); }
      if (conds.length) q += ' WHERE ' + conds.join(' AND ');
      q += ' ORDER BY a.created_at DESC LIMIT 200';
      const r = await client.query(q, params);
      return Response.json({ applications: r.rows });
    }

    // GET /api/admin/immigration-consultant/applications/[id]
    if (seg[0] === 'applications' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const [app, docs, tasks] = await Promise.all([
        client.query(`SELECT a.*, c.name AS client_name FROM immigration_application a
                      JOIN immigration_client c ON c.id=a.client_id WHERE a.id=$1`, [id]),
        client.query('SELECT * FROM immigration_document WHERE application_id=$1 ORDER BY created_at', [id]),
        client.query('SELECT * FROM immigration_task WHERE application_id=$1 ORDER BY due_date ASC', [id]),
      ]);
      if (!app.rowCount) return Response.json({ error: 'Application not found.' }, { status: 404 });
      return Response.json({ application: app.rows[0], documents: docs.rows, tasks: tasks.rows });
    }

    // GET /api/admin/immigration-consultant/applications/[id]/documents
    if (seg[0] === 'applications' && seg.length === 3 && seg[2] === 'documents') {
      const id = parseInt(seg[1]);
      const r = await client.query('SELECT * FROM immigration_document WHERE application_id=$1 ORDER BY created_at', [id]);
      return Response.json({ documents: r.rows });
    }

    // GET /api/admin/immigration-consultant/applications/[id]/tasks
    if (seg[0] === 'applications' && seg.length === 3 && seg[2] === 'tasks') {
      const id = parseInt(seg[1]);
      const r = await client.query('SELECT * FROM immigration_task WHERE application_id=$1 ORDER BY due_date ASC', [id]);
      return Response.json({ tasks: r.rows });
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
    const seg = url.pathname.replace(/.*\/immigration-consultant\/?/, '').split('/').filter(Boolean);
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    // POST /api/admin/immigration-consultant/clients
    if (seg[0] === 'clients' && seg.length === 1) {
      const { name, email, phone, nationality, country_of_birth, date_of_birth, passport_number,
              passport_expiry, current_country, current_status, marital_status, num_dependants,
              education_level, noc_code, occupation, clb_english, clb_french,
              work_experience_years, canadian_work_experience_years, provincial_nomination,
              province_nominated, crs_score, source, referral_name, status, notes } = body;
      if (!name?.trim()) return Response.json({ error: 'Client name is required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO immigration_client (name,email,phone,nationality,country_of_birth,date_of_birth,
          passport_number,passport_expiry,current_country,current_status,marital_status,num_dependants,
          education_level,noc_code,occupation,clb_english,clb_french,work_experience_years,
          canadian_work_experience_years,provincial_nomination,province_nominated,crs_score,
          source,referral_name,status,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *`,
        [name.trim(),email,phone,nationality,country_of_birth,date_of_birth||null,passport_number,
         passport_expiry||null,current_country||'Canada',current_status,marital_status,
         num_dependants||0,education_level,noc_code,occupation,clb_english,clb_french,
         work_experience_years,canadian_work_experience_years||0,provincial_nomination||false,
         province_nominated,crs_score,source,referral_name,status||'prospect',notes]);
      return Response.json({ client: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/immigration-consultant/applications
    if (seg[0] === 'applications' && seg.length === 1) {
      const { client_id, program_type, program_subtype, application_number, uci_number,
              submission_date, decision_date, status, biometrics_required, biometrics_date,
              medical_exam_required, medical_exam_date, ircc_fee, consultant_fee, notes, timeline_notes } = body;
      if (!client_id || !program_type?.trim()) return Response.json({ error: 'client_id and program_type are required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO immigration_application (client_id,program_type,program_subtype,application_number,
          uci_number,submission_date,decision_date,status,biometrics_required,biometrics_date,
          medical_exam_required,medical_exam_date,ircc_fee,consultant_fee,notes,timeline_notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [client_id,program_type.trim(),program_subtype,application_number,uci_number,
         submission_date||null,decision_date||null,status||'preparing',biometrics_required||false,
         biometrics_date||null,medical_exam_required||false,medical_exam_date||null,
         ircc_fee||null,consultant_fee||null,notes,timeline_notes]);
      return Response.json({ application: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/immigration-consultant/applications/[id]/documents
    if (seg[0] === 'applications' && seg.length === 3 && seg[2] === 'documents') {
      const app_id = parseInt(seg[1]);
      const { document_name, document_type, status, expiry_date, notes } = body;
      if (!document_name?.trim()) return Response.json({ error: 'document_name is required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO immigration_document (application_id,document_name,document_type,status,expiry_date,notes)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [app_id,document_name.trim(),document_type,status||'pending',expiry_date||null,notes]);
      return Response.json({ document: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/immigration-consultant/applications/[id]/tasks
    if (seg[0] === 'applications' && seg.length === 3 && seg[2] === 'tasks') {
      const app_id = parseInt(seg[1]);
      const { title, description, due_date, priority, assigned_to, status } = body;
      if (!title?.trim()) return Response.json({ error: 'Task title is required.' }, { status: 400 });
      const r = await client.query(`
        INSERT INTO immigration_task (application_id,title,description,due_date,priority,assigned_to,status)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [app_id,title.trim(),description,due_date||null,priority||'medium',assigned_to||'consultant',status||'pending']);
      return Response.json({ task: r.rows[0] }, { status: 201 });
    }

    // POST /api/admin/immigration-consultant/tasks/[id]/complete
    if (seg[0] === 'tasks' && seg.length === 3 && seg[2] === 'complete') {
      const task_id = parseInt(seg[1]);
      const r = await client.query(`
        UPDATE immigration_task SET status='completed', completed_at=NOW() WHERE id=$1 RETURNING *`, [task_id]);
      if (!r.rowCount) return Response.json({ error: 'Task not found.' }, { status: 404 });
      return Response.json({ task: r.rows[0] });
    }

    // POST /api/admin/immigration-consultant/ai-assess
    if (seg[0] === 'ai-assess') {
      const { crs_score, program_type, clb_english, work_experience_years, education_level } = body;
      const prompt = `Canadian immigration profile assessment:
- CRS Score: ${crs_score ?? 'Unknown'}
- Program interest: ${program_type ?? 'Not specified'}
- CLB English: ${clb_english ?? 'Not specified'}
- Work experience: ${work_experience_years ?? 0} years
- Education level: ${education_level ?? 'Not specified'}

Please evaluate:
1. Best IRCC programs for this profile (Express Entry, PNP, etc.)
2. Current Express Entry CRS cutoff context (recent draws ~400-520 range)
3. Provincial Nominee Program (PNP) options worth exploring
4. Estimated processing timeline
5. Top 3 tips to improve CRS score or pathway`;
      const result = await ollamaChat(prompt,
        'You are an expert on Canadian immigration programs including Express Entry, Provincial Nominee Programs (PNP), and IRCC processes. Provide clear, structured advice. Always recommend consulting a licensed RCIC for official guidance.');
      return Response.json({ assessment: result });
    }

    // POST /api/admin/immigration-consultant/document-checklist
    if (seg[0] === 'document-checklist') {
      const { program_type, program_subtype } = body;
      if (!program_type) return Response.json({ error: 'program_type is required.' }, { status: 400 });
      const prompt = `Generate a standard document checklist for a Canadian immigration application:
- Program type: ${program_type}
- Program subtype: ${program_subtype ?? 'General'}

List every required document in categories (Identity, Language, Education, Employment, Financial, Other).
Format as a numbered list with each document on its own line and a brief note on what is acceptable.`;
      const result = await ollamaChat(prompt,
        'You are an expert RCIC (Regulated Canadian Immigration Consultant) specializing in IRCC document requirements. Provide comprehensive, accurate document checklists. Note that requirements can change — always verify with official IRCC guidelines.');
      return Response.json({ checklist: result, program_type, program_subtype });
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
    const seg = url.pathname.replace(/.*\/immigration-consultant\/?/, '').split('/').filter(Boolean);
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    // PUT /api/admin/immigration-consultant/clients/[id]
    if (seg[0] === 'clients' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const fields = ['name','email','phone','nationality','country_of_birth','date_of_birth',
        'passport_number','passport_expiry','current_country','current_status','marital_status',
        'num_dependants','education_level','noc_code','occupation','clb_english','clb_french',
        'work_experience_years','canadian_work_experience_years','provincial_nomination',
        'province_nominated','crs_score','source','referral_name','status','notes'];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { params.push(body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
      params.push(id);
      const r = await client.query(`UPDATE immigration_client SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: r.rows[0] });
    }

    // PUT /api/admin/immigration-consultant/applications/[id]
    if (seg[0] === 'applications' && seg.length === 2) {
      const id = parseInt(seg[1]);
      const fields = ['program_type','program_subtype','application_number','uci_number',
        'submission_date','decision_date','status','biometrics_required','biometrics_date',
        'medical_exam_required','medical_exam_date','ircc_fee','consultant_fee','notes','timeline_notes'];
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { params.push(body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
      params.push(id);
      const r = await client.query(`UPDATE immigration_application SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r.rowCount) return Response.json({ error: 'Application not found.' }, { status: 404 });
      return Response.json({ application: r.rows[0] });
    }

    return Response.json({ error: 'Not found.' }, { status: 404 });
  } finally {
    client.release();
  }
}

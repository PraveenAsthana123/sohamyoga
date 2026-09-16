import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS advisory_client (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        company_name TEXT, industry TEXT, company_size TEXT,
        email TEXT, phone TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        business_stage TEXT,
        annual_revenue NUMERIC(12,2),
        primary_challenge TEXT,
        advisory_type TEXT[],
        status TEXT DEFAULT 'prospect',
        retainer_amount NUMERIC(8,2), retainer_frequency TEXT,
        hourly_rate NUMERIC(8,2),
        source TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS advisory_engagement (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES advisory_client(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        engagement_type TEXT NOT NULL,
        scope TEXT, objectives TEXT, expected_outcomes TEXT,
        start_date DATE, end_date DATE,
        status TEXT DEFAULT 'proposal',
        fee_type TEXT DEFAULT 'project',
        fee_amount NUMERIC(10,2),
        hours_estimated INT, hours_logged NUMERIC(8,2) DEFAULT 0,
        deliverables TEXT[],
        priority TEXT DEFAULT 'normal',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS advisory_session (
        id SERIAL PRIMARY KEY,
        engagement_id INT REFERENCES advisory_engagement(id) ON DELETE CASCADE,
        session_date TIMESTAMPTZ NOT NULL,
        duration_minutes INT,
        session_type TEXT DEFAULT 'meeting',
        agenda TEXT, notes TEXT, action_items TEXT[],
        next_session_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS advisory_deliverable (
        id SERIAL PRIMARY KEY,
        engagement_id INT REFERENCES advisory_engagement(id) ON DELETE CASCADE,
        title TEXT NOT NULL, description TEXT,
        due_date DATE, delivered_at TIMESTAMPTZ,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

function notConfigured() {
  return Response.json({ error: 'Database unavailable.' }, { status: 503 });
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return notConfigured();
  await ensureTables();

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (sub === 'clients') {
      const status = searchParams.get('status');
      const industry = searchParams.get('industry');
      const stage = searchParams.get('stage');
      const size = searchParams.get('size');
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
      if (industry) { params.push(industry); conditions.push(`c.industry = $${params.length}`); }
      if (stage) { params.push(stage); conditions.push(`c.business_stage = $${params.length}`); }
      if (size) { params.push(size); conditions.push(`c.company_size = $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT c.*,
          COUNT(e.id) FILTER (WHERE e.status = 'active') AS active_engagements,
          COALESCE(SUM(e.fee_amount) FILTER (WHERE e.status IN ('active','completed')), 0) AS total_billed
        FROM advisory_client c
        LEFT JOIN advisory_engagement e ON e.client_id = c.id
        ${where}
        GROUP BY c.id ORDER BY c.company_name, c.name
      `, params);
      return Response.json({ clients: rows });
    }

    if (sub === 'client-detail') {
      const id = parseInt(searchParams.get('id') ?? '0');
      if (!id) return Response.json({ error: 'id required.' }, { status: 400 });
      const [cRes, eRes] = await Promise.all([
        client.query(`SELECT * FROM advisory_client WHERE id=$1`, [id]),
        client.query(`SELECT e.*, COUNT(s.id) AS sessions, COUNT(d.id) AS deliverables,
          COUNT(d.id) FILTER (WHERE d.status='delivered') AS delivered_deliverables
          FROM advisory_engagement e
          LEFT JOIN advisory_session s ON s.engagement_id = e.id
          LEFT JOIN advisory_deliverable d ON d.engagement_id = e.id
          WHERE e.client_id = $1 GROUP BY e.id ORDER BY e.created_at DESC`, [id]),
      ]);
      if (!cRes.rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: cRes.rows[0], engagements: eRes.rows });
    }

    if (sub === 'engagements') {
      const status = searchParams.get('status');
      const etype = searchParams.get('type');
      const client_id = searchParams.get('client_id');
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
      if (etype) { params.push(etype); conditions.push(`e.engagement_type = $${params.length}`); }
      if (client_id) { params.push(parseInt(client_id)); conditions.push(`e.client_id = $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT e.*, c.name AS client_name, c.company_name,
          COUNT(s.id) AS session_count,
          COUNT(d.id) AS deliverable_count,
          COUNT(d.id) FILTER (WHERE d.status='delivered') AS delivered_count,
          COUNT(d.id) FILTER (WHERE d.due_date < CURRENT_DATE AND d.status NOT IN ('delivered','approved')) AS overdue_deliverables
        FROM advisory_engagement e
        LEFT JOIN advisory_client c ON c.id = e.client_id
        LEFT JOIN advisory_session s ON s.engagement_id = e.id
        LEFT JOIN advisory_deliverable d ON d.engagement_id = e.id
        ${where}
        GROUP BY e.id, c.name, c.company_name
        ORDER BY e.created_at DESC LIMIT 200
      `, params);
      return Response.json({ engagements: rows });
    }

    if (sub === 'sessions') {
      const engagement_id = parseInt(searchParams.get('engagement_id') ?? '0');
      if (!engagement_id) return Response.json({ error: 'engagement_id required.' }, { status: 400 });
      const { rows } = await client.query(
        `SELECT * FROM advisory_session WHERE engagement_id=$1 ORDER BY session_date DESC`, [engagement_id]);
      return Response.json({ sessions: rows });
    }

    if (sub === 'deliverables') {
      const engagement_id = parseInt(searchParams.get('engagement_id') ?? '0');
      if (!engagement_id) return Response.json({ error: 'engagement_id required.' }, { status: 400 });
      const { rows } = await client.query(
        `SELECT * FROM advisory_deliverable WHERE engagement_id=$1 ORDER BY due_date, created_at`, [engagement_id]);
      return Response.json({ deliverables: rows });
    }

    if (sub === 'all-action-items') {
      const { rows } = await client.query(`
        SELECT s.id, s.session_date, s.action_items, e.title AS engagement_title, c.name AS client_name
        FROM advisory_session s
        JOIN advisory_engagement e ON e.id = s.engagement_id
        JOIN advisory_client c ON c.id = e.client_id
        WHERE s.action_items IS NOT NULL AND array_length(s.action_items, 1) > 0
        ORDER BY s.session_date DESC LIMIT 100
      `);
      return Response.json({ sessions_with_actions: rows });
    }

    if (sub === 'stats') {
      const [act, hrs, rev, overdue, sessions] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE status='active') AS active_engagements,
            COUNT(*) FILTER (WHERE status='proposal') AS proposals,
            COUNT(*) FILTER (WHERE status='completed') AS completed,
            COALESCE(SUM(fee_amount) FILTER (WHERE status IN ('active','proposal')), 0) AS pipeline_value,
            COALESCE(SUM(fee_amount) FILTER (WHERE status='completed'), 0) AS completed_value
          FROM advisory_engagement
        `),
        client.query(`
          SELECT COALESCE(SUM(hours_logged) FILTER (WHERE s.session_date >= date_trunc('month',NOW())),0) AS hours_this_month,
            COALESCE(SUM(hours_logged),0) AS total_hours
          FROM advisory_engagement
          LEFT JOIN advisory_session s ON s.engagement_id = advisory_engagement.id
          WHERE advisory_engagement.status = 'active'
        `),
        client.query(`
          SELECT COALESCE(SUM(retainer_amount) FILTER (WHERE status IN ('active','retainer')), 0) AS mrr
          FROM advisory_client
        `),
        client.query(`
          SELECT COUNT(*) AS overdue_deliverables FROM advisory_deliverable
          WHERE due_date < CURRENT_DATE AND status NOT IN ('delivered','approved')
        `),
        client.query(`
          SELECT s.*, e.title AS engagement_title, c.name AS client_name
          FROM advisory_session s
          JOIN advisory_engagement e ON e.id = s.engagement_id
          JOIN advisory_client c ON c.id = e.client_id
          WHERE s.session_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          ORDER BY s.session_date LIMIT 10
        `),
      ]);
      return Response.json({
        ...act.rows[0],
        ...hrs.rows[0],
        mrr: rev.rows[0].mrr,
        overdue_deliverables: overdue.rows[0].overdue_deliverables,
        upcoming_sessions: sessions.rows,
      });
    }

    if (sub === 'revenue') {
      const [byType, retainers, uninvoiced] = await Promise.all([
        client.query(`
          SELECT engagement_type,
            COUNT(*) AS engagements,
            COALESCE(SUM(fee_amount) FILTER (WHERE status='completed'), 0) AS earned,
            COALESCE(SUM(hours_logged), 0) AS total_hours
          FROM advisory_engagement GROUP BY 1 ORDER BY earned DESC
        `),
        client.query(`
          SELECT c.*, c.retainer_amount * CASE c.retainer_frequency WHEN 'quarterly' THEN 1.0/3 ELSE 1 END AS monthly_value
          FROM advisory_client c WHERE c.status IN ('active','retainer') AND c.retainer_amount > 0
          ORDER BY c.retainer_amount DESC
        `),
        client.query(`
          SELECT e.*, c.name AS client_name, c.company_name
          FROM advisory_engagement e
          JOIN advisory_client c ON c.id = e.client_id
          WHERE e.status = 'completed' AND e.fee_amount > 0
          ORDER BY e.end_date
        `),
      ]);
      return Response.json({ by_type: byType.rows, retainers: retainers.rows, uninvoiced: uninvoiced.rows });
    }

    // Default: dashboard
    const [statsR, upSessions, overdueD] = await Promise.all([
      client.query(`
        SELECT
          COUNT(e.id) FILTER (WHERE e.status='active') AS active_engagements,
          COUNT(e.id) FILTER (WHERE e.status='proposal') AS proposals,
          COALESCE(SUM(c.retainer_amount) FILTER (WHERE c.status IN ('active','retainer')), 0) AS mrr,
          COALESCE(SUM(e.fee_amount) FILTER (WHERE e.status IN ('active','proposal')), 0) AS pipeline_value
        FROM advisory_engagement e
        JOIN advisory_client c ON c.id = e.client_id
      `),
      client.query(`
        SELECT s.*, e.title, c.name AS client_name
        FROM advisory_session s
        JOIN advisory_engagement e ON e.id = s.engagement_id
        JOIN advisory_client c ON c.id = e.client_id
        WHERE s.session_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY s.session_date LIMIT 8
      `),
      client.query(`
        SELECT d.*, e.title AS engagement_title, c.name AS client_name
        FROM advisory_deliverable d
        JOIN advisory_engagement e ON e.id = d.engagement_id
        JOIN advisory_client c ON c.id = e.client_id
        WHERE d.due_date < CURRENT_DATE AND d.status NOT IN ('delivered','approved')
        ORDER BY d.due_date LIMIT 10
      `),
    ]);
    return Response.json({ stats: statsR.rows[0], upcoming_sessions: upSessions.rows, overdue_deliverables: overdueD.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return notConfigured();
  await ensureTables();

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    // ── AI Framework Recommender ───────────────────────────────────
    if (sub === 'ai-framework') {
      const { engagement_type = '', challenge = '', company_size = '', industry = '' } = b;
      const prompt = `You are a senior management consultant. Recommend the top 3 consulting frameworks for this client engagement:

ENGAGEMENT TYPE: ${engagement_type}
PRIMARY CHALLENGE: ${challenge}
COMPANY SIZE: ${company_size}
INDUSTRY: ${industry}

For each framework recommendation, provide:
1. FRAMEWORK NAME (e.g., McKinsey 7S, Porter's Five Forces, SWOT, Balanced Scorecard, OKRs, Jobs-to-be-Done, PESTLE, Value Chain Analysis, BCG Matrix, Ansoff Matrix, Lean Six Sigma, Design Thinking, Kotter's Change Model)
2. WHY IT FITS this specific situation (2-3 sentences)
3. HOW TO APPLY IT for this client (practical steps)
4. KEY OUTPUTS/DELIVERABLES this framework produces
5. TIMELINE estimate to complete this framework analysis

Rank them: #1 Best fit, #2 Strong alternative, #3 Supporting framework.
Be specific to the engagement type and company context.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ frameworks: data.response ?? '' });
      } catch {
        const fallbacks: Record<string, string> = {
          strategy: '#1 Porter\'s Five Forces — Maps competitive dynamics.\n#2 SWOT Analysis — Identifies strategic position.\n#3 Ansoff Matrix — Clarifies growth options.',
          operations: '#1 Lean Six Sigma — Eliminates waste and variation.\n#2 Value Chain Analysis — Identifies optimization points.\n#3 PESTLE — Scans operational environment.',
          finance: '#1 Balanced Scorecard — Links financial to operational KPIs.\n#2 Financial Ratio Analysis — Benchmarks against industry.\n#3 Cash Flow Forecasting Model — Projects liquidity.',
          hr: '#1 McKinsey 7S — Aligns structure, strategy, systems, staff.\n#2 Organizational Design Canvas — Clarifies reporting and roles.\n#3 Kotter\'s 8-Step Change Model — Guides people transformation.',
          startup: '#1 Lean Canvas — One-page business model.\n#2 Jobs-to-be-Done — Grounds product in customer outcomes.\n#3 OKRs — Sets measurable goals for the team.',
        };
        return Response.json({ frameworks: `[AI Offline — Framework Guide]\n\n${fallbacks[engagement_type] ?? '#1 SWOT Analysis\n#2 Balanced Scorecard\n#3 McKinsey 7S\n\nRetry when AI is available for a detailed recommendation.'}` });
      }
    }

    // ── AI Proposal Generator ──────────────────────────────────────
    if (sub === 'ai-proposal') {
      const { client_name = '', company = '', challenge = '', engagement_type = '', duration_weeks = 8, fee = '' } = b;
      const prompt = `You are a senior management consultant. Write a professional consulting proposal for:

CLIENT: ${client_name} at ${company}
PRIMARY CHALLENGE: ${challenge}
ENGAGEMENT TYPE: ${engagement_type}
DURATION: ${duration_weeks} weeks
INVESTMENT: ${fee}

Write a complete, professional proposal with:

1. EXECUTIVE SUMMARY (2-3 sentences — the problem, our approach, the outcome)
2. PROBLEM STATEMENT (detailed articulation of the challenge and business impact)
3. PROPOSED APPROACH (our methodology, phases, and why this works)
4. DELIVERABLES (concrete, numbered list of what the client receives)
5. PROJECT TIMELINE (week-by-week or phase milestones)
6. INVESTMENT (fee structure, what's included/excluded, payment terms)
7. ABOUT US (1 paragraph on our firm's relevant expertise)
8. NEXT STEPS (3 clear action items to proceed)

Use professional consulting language. Be specific. Avoid jargon. This should be client-ready.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ proposal: data.response ?? '' });
      } catch {
        return Response.json({ proposal: `[AI Offline — Proposal Template]\n\n# Consulting Proposal\n**Prepared for:** ${client_name}, ${company}\n**Date:** ${new Date().toLocaleDateString('en-CA')}\n\n## Executive Summary\nWe propose a ${duration_weeks}-week ${engagement_type} engagement to address ${challenge} at ${company}. Our structured methodology will deliver actionable recommendations and implementation support.\n\n## Problem Statement\n[Describe the challenge in detail]\n\n## Proposed Approach\n[Outline the consulting methodology]\n\n## Deliverables\n1. Current state assessment\n2. Gap analysis report\n3. Recommendations framework\n4. Implementation roadmap\n5. Executive presentation\n\n## Timeline\nWeek 1-2: Discovery & Assessment\nWeek 3-4: Analysis & Framework Development\nWeek 5-6: Recommendations & Validation\nWeek 7-${duration_weeks}: Implementation Support\n\n## Investment\n${fee ? `Total Investment: ${fee}` : 'Investment: [To be discussed]'}\n\n## Next Steps\n1. Review and sign proposal\n2. Schedule kick-off meeting\n3. Provide access to key stakeholders` });
      }
    }

    // ── AI Agenda Generator ────────────────────────────────────────
    if (sub === 'ai-agenda') {
      const { engagement_type = '', session_goals = '' } = b;
      const prompt = `You are a management consultant. Create a structured meeting agenda for a ${engagement_type} consulting session.

SESSION GOALS: ${session_goals}

Generate a professional agenda with:
1. OPENING (5 min) — Purpose, introductions, ground rules
2. CONTEXT SETTING (10 min) — Review of prior session/progress
3. MAIN AGENDA ITEMS (structured by time block)
4. DECISION POINTS — What decisions need to be made today
5. ACTION ITEM REVIEW — Review prior actions, confirm owners
6. NEXT STEPS (10 min) — Assign new actions, confirm next session
7. CLOSE (5 min)

Include time allocations for each section. Total = 60-90 minutes unless otherwise indicated. Make it practical and specific to the engagement type.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ agenda: data.response ?? '' });
      } catch {
        return Response.json({ agenda: `[AI Offline — Agenda Template]\n\n## Session Agenda — ${engagement_type}\n\n**Goals:** ${session_goals}\n\n| Time | Item | Owner |\n|------|------|-------|\n| 0:00 | Welcome & Purpose | Consultant |\n| 0:05 | Progress Review | All |\n| 0:15 | Main Discussion: [Topic 1] | Client Lead |\n| 0:30 | Main Discussion: [Topic 2] | Consultant |\n| 0:45 | Decision Points | All |\n| 0:55 | Action Item Review | All |\n| 1:05 | Next Steps & Next Session | Consultant |\n| 1:10 | Close | All |` });
      }
    }

    // ── AI SWOT Generator ──────────────────────────────────────────
    if (sub === 'ai-swot') {
      const { company_name = '', industry = '', situation = '' } = b;
      const prompt = `You are a strategic consultant. Generate a preliminary SWOT analysis for:

COMPANY: ${company_name}
INDUSTRY: ${industry}
SITUATION: ${situation}

Provide a structured SWOT analysis:

STRENGTHS (internal positives — what they do well):
- List 4-6 specific strengths based on the context

WEAKNESSES (internal negatives — areas to improve):
- List 4-6 specific weaknesses to address

OPPORTUNITIES (external positives — market/environment factors):
- List 4-6 specific opportunities to pursue

THREATS (external negatives — risks and challenges):
- List 4-6 specific threats to mitigate

After the SWOT grid, add:
STRATEGIC IMPLICATIONS — 3 key "SO", "WO", "ST", "WT" strategic options
TOP PRIORITY — The single most critical strategic move based on this analysis

Be specific to the industry and situation described.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ swot: data.response ?? '' });
      } catch {
        return Response.json({ swot: `[AI Offline — SWOT Template]\n\n## SWOT Analysis — ${company_name}\n\n**STRENGTHS**\n- [Identify internal strengths]\n- [Core competencies]\n- [Resource advantages]\n\n**WEAKNESSES**\n- [Internal gaps to address]\n- [Resource constraints]\n- [Capability gaps]\n\n**OPPORTUNITIES**\n- [Market growth areas]\n- [Technology trends]\n- [Competitive gaps to exploit]\n\n**THREATS**\n- [Competitive threats]\n- [Market risks]\n- [Regulatory/economic pressures]\n\nIndustry: ${industry}\nSituation: ${situation}\n\nRetry when AI is available for a detailed, context-specific SWOT.` });
      }
    }

    // ── Client CRUD ────────────────────────────────────────────────
    if (sub === 'clients') {
      const { name, company_name, industry, company_size, email, phone, city, province,
        business_stage, annual_revenue, primary_challenge, advisory_type, status,
        retainer_amount, retainer_frequency, hourly_rate, source, notes } = b;
      if (!name?.trim()) return Response.json({ error: 'Client name required.' }, { status: 400 });
      const { rows } = await client.query(`
        INSERT INTO advisory_client (name,company_name,industry,company_size,email,phone,city,province,
          business_stage,annual_revenue,primary_challenge,advisory_type,status,
          retainer_amount,retainer_frequency,hourly_rate,source,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *
      `, [name.trim(), company_name||null, industry||null, company_size||null,
          email||null, phone||null, city||'Calgary', province||'AB',
          business_stage||null, annual_revenue||null, primary_challenge||null,
          advisory_type||null, status||'prospect',
          retainer_amount||null, retainer_frequency||null, hourly_rate||null,
          source||null, notes||null]);
      return Response.json({ client: rows[0] }, { status: 201 });
    }

    // ── Engagement CRUD ────────────────────────────────────────────
    if (sub === 'engagements') {
      const { client_id, title, engagement_type, scope, objectives, expected_outcomes,
        start_date, end_date, status, fee_type, fee_amount, hours_estimated,
        deliverables, priority, notes } = b;
      if (!title?.trim() || !engagement_type) return Response.json({ error: 'Title and type required.' }, { status: 400 });
      const { rows } = await client.query(`
        INSERT INTO advisory_engagement (client_id,title,engagement_type,scope,objectives,expected_outcomes,
          start_date,end_date,status,fee_type,fee_amount,hours_estimated,deliverables,priority,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *
      `, [client_id||null, title.trim(), engagement_type, scope||null, objectives||null,
          expected_outcomes||null, start_date||null, end_date||null,
          status||'proposal', fee_type||'project', fee_amount||null, hours_estimated||null,
          deliverables||null, priority||'normal', notes||null]);
      return Response.json({ engagement: rows[0] }, { status: 201 });
    }

    // ── Session logging ────────────────────────────────────────────
    if (sub === 'sessions') {
      const engagement_id = parseInt(searchParams.get('engagement_id') ?? '0');
      if (!engagement_id) return Response.json({ error: 'engagement_id required.' }, { status: 400 });
      const { session_date, duration_minutes, session_type, agenda, notes: sNotes, action_items, next_session_date } = b;
      if (!session_date) return Response.json({ error: 'session_date required.' }, { status: 400 });
      // Log hours to engagement
      const hrs = duration_minutes ? duration_minutes / 60 : 0;
      await client.query(`UPDATE advisory_engagement SET hours_logged=hours_logged+$2 WHERE id=$1`, [engagement_id, hrs]);
      const { rows } = await client.query(`
        INSERT INTO advisory_session (engagement_id,session_date,duration_minutes,session_type,agenda,notes,action_items,next_session_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [engagement_id, session_date, duration_minutes||null, session_type||'meeting',
          agenda||null, sNotes||null, action_items||null, next_session_date||null]);
      return Response.json({ session: rows[0] }, { status: 201 });
    }

    // ── Deliverable CRUD ───────────────────────────────────────────
    if (sub === 'deliverables') {
      const engagement_id = parseInt(searchParams.get('engagement_id') ?? '0');
      if (!engagement_id) return Response.json({ error: 'engagement_id required.' }, { status: 400 });
      const { title, description, due_date, notes: dNotes } = b;
      if (!title?.trim()) return Response.json({ error: 'Title required.' }, { status: 400 });
      const { rows } = await client.query(`
        INSERT INTO advisory_deliverable (engagement_id,title,description,due_date,notes)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [engagement_id, title.trim(), description||null, due_date||null, dNotes||null]);
      return Response.json({ deliverable: rows[0] }, { status: 201 });
    }

    // ── Deliver deliverable ────────────────────────────────────────
    if (sub === 'deliver-deliverable') {
      const id = parseInt(searchParams.get('id') ?? '0');
      if (!id) return Response.json({ error: 'id required.' }, { status: 400 });
      const { rows } = await client.query(
        `UPDATE advisory_deliverable SET status='delivered', delivered_at=NOW() WHERE id=$1 RETURNING *`, [id]);
      if (!rows.length) return Response.json({ error: 'Deliverable not found.' }, { status: 404 });
      return Response.json({ deliverable: rows[0] });
    }

    return Response.json({ error: 'Unknown sub-action.' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return notConfigured();
  await ensureTables();

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');
  const id = parseInt(searchParams.get('id') ?? '0');
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (sub === 'clients') {
      const { name, company_name, industry, company_size, email, phone, city, province,
        business_stage, annual_revenue, primary_challenge, advisory_type, status,
        retainer_amount, retainer_frequency, hourly_rate, source, notes } = b;
      const { rows } = await client.query(`
        UPDATE advisory_client SET
          name=COALESCE($2,name), company_name=COALESCE($3,company_name),
          industry=COALESCE($4,industry), company_size=COALESCE($5,company_size),
          email=COALESCE($6,email), phone=COALESCE($7,phone),
          city=COALESCE($8,city), province=COALESCE($9,province),
          business_stage=COALESCE($10,business_stage), annual_revenue=COALESCE($11,annual_revenue),
          primary_challenge=COALESCE($12,primary_challenge), advisory_type=COALESCE($13,advisory_type),
          status=COALESCE($14,status), retainer_amount=COALESCE($15,retainer_amount),
          retainer_frequency=COALESCE($16,retainer_frequency), hourly_rate=COALESCE($17,hourly_rate),
          source=COALESCE($18,source), notes=COALESCE($19,notes)
        WHERE id=$1 RETURNING *
      `, [id, name||null, company_name||null, industry||null, company_size||null,
          email||null, phone||null, city||null, province||null,
          business_stage||null, annual_revenue||null, primary_challenge||null,
          advisory_type||null, status||null, retainer_amount||null,
          retainer_frequency||null, hourly_rate||null, source||null, notes||null]);
      if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: rows[0] });
    }

    if (sub === 'engagements') {
      const { title, engagement_type, scope, objectives, expected_outcomes, start_date, end_date,
        status, fee_type, fee_amount, hours_estimated, deliverables, priority, notes } = b;
      const { rows } = await client.query(`
        UPDATE advisory_engagement SET
          title=COALESCE($2,title), engagement_type=COALESCE($3,engagement_type),
          scope=COALESCE($4,scope), objectives=COALESCE($5,objectives),
          expected_outcomes=COALESCE($6,expected_outcomes),
          start_date=COALESCE($7,start_date), end_date=COALESCE($8,end_date),
          status=COALESCE($9,status), fee_type=COALESCE($10,fee_type),
          fee_amount=COALESCE($11,fee_amount), hours_estimated=COALESCE($12,hours_estimated),
          deliverables=COALESCE($13,deliverables), priority=COALESCE($14,priority),
          notes=COALESCE($15,notes)
        WHERE id=$1 RETURNING *
      `, [id, title||null, engagement_type||null, scope||null, objectives||null,
          expected_outcomes||null, start_date||null, end_date||null, status||null,
          fee_type||null, fee_amount||null, hours_estimated||null, deliverables||null,
          priority||null, notes||null]);
      if (!rows.length) return Response.json({ error: 'Engagement not found.' }, { status: 404 });
      return Response.json({ engagement: rows[0] });
    }

    if (sub === 'deliverables') {
      const { title, description, due_date, status, notes } = b;
      const { rows } = await client.query(`
        UPDATE advisory_deliverable SET
          title=COALESCE($2,title), description=COALESCE($3,description),
          due_date=COALESCE($4,due_date), status=COALESCE($5,status),
          notes=COALESCE($6,notes)
        WHERE id=$1 RETURNING *
      `, [id, title||null, description||null, due_date||null, status||null, notes||null]);
      if (!rows.length) return Response.json({ error: 'Deliverable not found.' }, { status: 404 });
      return Response.json({ deliverable: rows[0] });
    }

    return Response.json({ error: 'Unknown sub.' }, { status: 400 });
  } finally {
    client.release();
  }
}

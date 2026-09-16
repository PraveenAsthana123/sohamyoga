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
      CREATE TABLE IF NOT EXISTS writing_client (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL, email TEXT, phone TEXT,
        company TEXT, industry TEXT,
        preferred_tone TEXT DEFAULT 'professional',
        preferred_style_guide TEXT,
        brand_voice_notes TEXT,
        target_audience TEXT,
        status TEXT DEFAULT 'active',
        hourly_rate NUMERIC(8,2),
        source TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS writing_project (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES writing_client(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        project_type TEXT NOT NULL,
        description TEXT,
        word_count_target INT,
        word_count_delivered INT DEFAULT 0,
        keywords TEXT[],
        deadline DATE,
        status TEXT DEFAULT 'briefing',
        priority TEXT DEFAULT 'normal',
        rate_type TEXT DEFAULT 'per_word',
        rate NUMERIC(8,4),
        estimated_fee NUMERIC(10,2),
        actual_fee NUMERIC(10,2),
        draft_due DATE, final_due DATE,
        revisions_allowed INT DEFAULT 2, revisions_used INT DEFAULT 0,
        delivered_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
        brief_notes TEXT, research_notes TEXT, outline TEXT,
        platform TEXT,
        assigned_writer TEXT DEFAULT 'self',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS writing_revision (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES writing_project(id) ON DELETE CASCADE,
        revision_number INT,
        feedback TEXT,
        changes_requested TEXT,
        completed_at TIMESTAMPTZ,
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
      const { rows } = await client.query(`
        SELECT c.*,
          COUNT(p.id) FILTER (WHERE p.status NOT IN ('delivered','invoiced','paid')) AS active_projects,
          COALESCE(SUM(p.actual_fee) FILTER (WHERE p.paid_at IS NOT NULL), 0) AS total_earned
        FROM writing_client c
        LEFT JOIN writing_project p ON p.client_id = c.id
        GROUP BY c.id ORDER BY c.name
      `);
      return Response.json({ clients: rows });
    }

    if (sub === 'projects') {
      const status = searchParams.get('status');
      const project_type = searchParams.get('project_type');
      const client_id = searchParams.get('client_id');
      const overdue = searchParams.get('overdue');

      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
      if (project_type) { params.push(project_type); conditions.push(`p.project_type = $${params.length}`); }
      if (client_id) { params.push(parseInt(client_id)); conditions.push(`p.client_id = $${params.length}`); }
      if (overdue === 'true') { conditions.push(`p.deadline < CURRENT_DATE AND p.status NOT IN ('delivered','invoiced','paid')`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT p.*, c.name AS client_name, c.company AS client_company
        FROM writing_project p
        LEFT JOIN writing_client c ON c.id = p.client_id
        ${where}
        ORDER BY p.priority DESC, p.deadline ASC NULLS LAST, p.created_at DESC
        LIMIT 200
      `, params);
      return Response.json({ projects: rows });
    }

    if (sub === 'stats') {
      const [active, revenue, words] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE status NOT IN ('delivered','invoiced','paid')) AS active_projects,
            COUNT(*) FILTER (WHERE status = 'drafting') AS drafting,
            COUNT(*) FILTER (WHERE deadline < CURRENT_DATE AND status NOT IN ('delivered','invoiced','paid')) AS overdue,
            COUNT(*) FILTER (WHERE delivered_at >= date_trunc('month', NOW())) AS delivered_this_month
          FROM writing_project
        `),
        client.query(`
          SELECT
            COALESCE(SUM(actual_fee) FILTER (WHERE paid_at >= date_trunc('month', NOW())), 0) AS revenue_this_month,
            COALESCE(SUM(actual_fee) FILTER (WHERE paid_at >= date_trunc('year', NOW())), 0) AS revenue_this_year
          FROM writing_project WHERE paid_at IS NOT NULL
        `),
        client.query(`
          SELECT
            COALESCE(SUM(word_count_delivered) FILTER (WHERE delivered_at >= date_trunc('month', NOW())), 0) AS words_this_month,
            COALESCE(SUM(word_count_delivered) FILTER (WHERE delivered_at >= date_trunc('year', NOW())), 0) AS words_this_year,
            COALESCE(AVG(rate) FILTER (WHERE rate_type = 'per_word' AND rate > 0), 0) AS avg_per_word_rate
          FROM writing_project
        `),
      ]);
      return Response.json({ ...active.rows[0], ...revenue.rows[0], ...words.rows[0] });
    }

    if (sub === 'revenue') {
      const { rows: monthly } = await client.query(`
        SELECT
          to_char(date_trunc('month', paid_at), 'Mon YYYY') AS month,
          date_trunc('month', paid_at) AS month_start,
          SUM(actual_fee) AS revenue,
          COUNT(*) AS projects_paid
        FROM writing_project
        WHERE paid_at >= NOW() - INTERVAL '6 months' AND paid_at IS NOT NULL
        GROUP BY 1, 2 ORDER BY 2
      `);
      const { rows: by_type } = await client.query(`
        SELECT project_type, COUNT(*) AS cnt,
          COALESCE(SUM(actual_fee) FILTER (WHERE paid_at IS NOT NULL), 0) AS earned,
          COALESCE(AVG(rate) FILTER (WHERE rate_type='per_word'), 0) AS avg_rate
        FROM writing_project GROUP BY 1 ORDER BY earned DESC
      `);
      const { rows: outstanding } = await client.query(`
        SELECT p.*, c.name AS client_name
        FROM writing_project p
        LEFT JOIN writing_client c ON c.id = p.client_id
        WHERE p.status = 'delivered' AND p.paid_at IS NULL
        ORDER BY p.delivered_at
      `);
      return Response.json({ monthly, by_type, outstanding });
    }

    // Default: dashboard summary
    const [stats, upcoming, recent] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('delivered','invoiced','paid')) AS active_projects,
          COUNT(*) FILTER (WHERE status='drafting') AS drafting,
          COUNT(*) FILTER (WHERE deadline < CURRENT_DATE AND status NOT IN ('delivered','invoiced','paid')) AS overdue,
          COALESCE(SUM(actual_fee) FILTER (WHERE paid_at >= date_trunc('month', NOW())), 0) AS revenue_this_month,
          COALESCE(SUM(word_count_delivered) FILTER (WHERE delivered_at >= date_trunc('month', NOW())), 0) AS words_this_month
        FROM writing_project
      `),
      client.query(`
        SELECT p.*, c.name AS client_name
        FROM writing_project p
        LEFT JOIN writing_client c ON c.id = p.client_id
        WHERE p.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
          AND p.status NOT IN ('delivered','invoiced','paid')
        ORDER BY p.deadline LIMIT 10
      `),
      client.query(`
        SELECT p.*, c.name AS client_name
        FROM writing_project p
        LEFT JOIN writing_client c ON c.id = p.client_id
        ORDER BY p.created_at DESC LIMIT 10
      `),
    ]);
    return Response.json({ stats: stats.rows[0], upcoming: upcoming.rows, recent: recent.rows });
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
    // ── AI endpoints ──────────────────────────────────────────────
    if (sub === 'ai-write') {
      const { project_type = 'blog_post', title = '', keywords = [], tone = 'professional', word_count = 500, brief = '' } = b;
      const prompt = `You are a professional ${project_type.replace('_',' ')} writer. Write high-quality content based on:

TITLE: ${title}
TYPE: ${project_type}
TONE: ${tone}
TARGET WORD COUNT: ${word_count}
KEYWORDS TO INCLUDE: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}
BRIEF/INSTRUCTIONS: ${brief}

Write complete, polished content ready for review. Use proper structure with headings where appropriate. Naturally incorporate the keywords. Match the specified tone throughout.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ content: data.response ?? '' });
      } catch {
        return Response.json({ content: `[AI Offline — Draft Placeholder]\n\n# ${title}\n\nThis is a placeholder draft for a ${project_type} piece with a ${tone} tone targeting approximately ${word_count} words.\n\nKeywords to incorporate: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}\n\nBrief: ${brief}\n\nPlease write your content here or retry when the AI service is available.` });
      }
    }

    if (sub === 'ai-outline') {
      const { project_type = 'article', title = '', keywords = [], target_audience = 'general' } = b;
      const prompt = `Create a detailed, structured outline for a ${project_type} titled "${title}".

TARGET AUDIENCE: ${target_audience}
KEYWORDS: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}

Provide a complete outline with:
1. Hook / Opening angle
2. Main sections (H2s) with sub-points (H3s)
3. Key points to cover in each section
4. Call to action or conclusion angle
5. Suggested word count per section

Format clearly with numbered sections and bullet points.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ outline: data.response ?? '' });
      } catch {
        return Response.json({ outline: `[AI Offline — Outline Placeholder]\n\n# ${title} — Outline\n\n1. Introduction\n   - Hook\n   - Context\n   - Thesis\n\n2. Main Section A\n   - Key point 1\n   - Key point 2\n\n3. Main Section B\n   - Key point 1\n   - Key point 2\n\n4. Main Section C\n   - Key point 1\n   - Key point 2\n\n5. Conclusion\n   - Summary\n   - Call to action\n\nKeywords to distribute: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}` });
      }
    }

    if (sub === 'ai-headline') {
      const { topic = '', tone = 'professional', count = 5 } = b;
      const prompt = `Generate ${count} compelling, high-performing headline options for the topic: "${topic}"

TONE: ${tone}
QUANTITY: ${count} headlines

Requirements:
- Each headline should be distinct in angle and approach
- Mix question, how-to, list, and statement formats
- Use power words appropriate for ${tone} tone
- Keep under 70 characters when possible for SEO

Number each headline. Briefly note the angle/approach for each.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ headlines: data.response ?? '' });
      } catch {
        const fallbacks = [
          `1. How to Master ${topic}: A Complete Guide`,
          `2. ${topic}: Everything You Need to Know`,
          `3. The Ultimate ${topic} Strategy for 2026`,
          `4. Why ${topic} Matters More Than Ever`,
          `5. ${topic}: Proven Tips from Industry Experts`,
        ].slice(0, count);
        return Response.json({ headlines: fallbacks.join('\n') });
      }
    }

    if (sub === 'ai-research') {
      const { topic = '' } = b;
      const prompt = `You are a professional researcher and content strategist. For the topic "${topic}", generate:

1. CORE RESEARCH QUESTIONS (5-7 questions to investigate)
2. KEY ANGLES & PERSPECTIVES (different ways to approach this topic)
3. PRIMARY SOURCES TO CHECK (types of authoritative sources)
4. STATISTICS TO LOOK FOR (what data would strengthen this piece)
5. EXPERT VOICES TO CITE (types of experts/credentials to look for)
6. COMMON MISCONCEPTIONS TO ADDRESS
7. TRENDING SUBTOPICS (what's current in this space)

Be specific and actionable. This will guide a writer's research process.`;
      try {
        const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
        const data = await resp.json() as { response?: string };
        return Response.json({ research: data.response ?? '' });
      } catch {
        return Response.json({ research: `[AI Offline — Research Prompt Placeholder]\n\nTopic: ${topic}\n\n1. CORE RESEARCH QUESTIONS:\n   - What is the current state of ${topic}?\n   - What are the key challenges?\n   - What solutions exist?\n\n2. KEY ANGLES:\n   - Educational/informational\n   - Problem/solution\n   - Case study/example\n\n3. SOURCES TO CHECK:\n   - Industry reports\n   - Academic journals\n   - Expert interviews\n   - Government/regulatory bodies` });
      }
    }

    // ── Client CRUD ────────────────────────────────────────────────
    if (sub === 'clients') {
      const { name, email, phone, company, industry, preferred_tone, preferred_style_guide,
        brand_voice_notes, target_audience, status, hourly_rate, source, notes } = b;
      if (!name?.trim()) return Response.json({ error: 'Client name required.' }, { status: 400 });
      const { rows } = await client.query(`
        INSERT INTO writing_client (name,email,phone,company,industry,preferred_tone,preferred_style_guide,
          brand_voice_notes,target_audience,status,hourly_rate,source,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [name.trim(), email||null, phone||null, company||null, industry||null,
          preferred_tone||'professional', preferred_style_guide||null,
          brand_voice_notes||null, target_audience||null,
          status||'active', hourly_rate||null, source||null, notes||null]);
      return Response.json({ client: rows[0] }, { status: 201 });
    }

    // ── Project CRUD ───────────────────────────────────────────────
    if (sub === 'projects') {
      const { client_id, title, project_type, description, word_count_target, keywords,
        deadline, priority, rate_type, rate, estimated_fee, draft_due, final_due,
        revisions_allowed, brief_notes, platform, assigned_writer } = b;
      if (!title?.trim() || !project_type) return Response.json({ error: 'Title and project type required.' }, { status: 400 });
      const { rows } = await client.query(`
        INSERT INTO writing_project (client_id,title,project_type,description,word_count_target,keywords,
          deadline,priority,rate_type,rate,estimated_fee,draft_due,final_due,revisions_allowed,
          brief_notes,platform,assigned_writer)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *
      `, [client_id||null, title.trim(), project_type, description||null,
          word_count_target||null, keywords||null,
          deadline||null, priority||'normal', rate_type||'per_word', rate||null,
          estimated_fee||null, draft_due||null, final_due||null,
          revisions_allowed ?? 2, brief_notes||null, platform||null,
          assigned_writer||'self']);
      return Response.json({ project: rows[0] }, { status: 201 });
    }

    // ── Revisions ──────────────────────────────────────────────────
    if (sub === 'revisions') {
      const project_id = parseInt(searchParams.get('project_id') ?? '0');
      if (!project_id) return Response.json({ error: 'project_id required.' }, { status: 400 });
      const { feedback, changes_requested } = b;
      const { rows: cnt } = await client.query(
        `SELECT COUNT(*) AS n FROM writing_revision WHERE project_id=$1`, [project_id]);
      const rev_num = parseInt(cnt[0].n) + 1;
      await client.query(`UPDATE writing_project SET revisions_used=revisions_used+1, status='revision' WHERE id=$1`, [project_id]);
      const { rows } = await client.query(`
        INSERT INTO writing_revision (project_id,revision_number,feedback,changes_requested)
        VALUES ($1,$2,$3,$4) RETURNING *
      `, [project_id, rev_num, feedback||null, changes_requested||null]);
      return Response.json({ revision: rows[0] }, { status: 201 });
    }

    // ── Deliver ────────────────────────────────────────────────────
    if (sub === 'deliver') {
      const project_id = parseInt(searchParams.get('project_id') ?? '0');
      if (!project_id) return Response.json({ error: 'project_id required.' }, { status: 400 });
      const { word_count_delivered, actual_fee } = b;
      const { rows } = await client.query(`
        UPDATE writing_project
        SET status='delivered', delivered_at=NOW(),
            word_count_delivered=COALESCE($2, word_count_delivered),
            actual_fee=COALESCE($3, actual_fee)
        WHERE id=$1 RETURNING *
      `, [project_id, word_count_delivered||null, actual_fee||null]);
      if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
      return Response.json({ project: rows[0] });
    }

    // ── Approve ────────────────────────────────────────────────────
    if (sub === 'approve') {
      const project_id = parseInt(searchParams.get('project_id') ?? '0');
      if (!project_id) return Response.json({ error: 'project_id required.' }, { status: 400 });
      const { rows } = await client.query(
        `UPDATE writing_project SET status='approved' WHERE id=$1 RETURNING *`, [project_id]);
      if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
      return Response.json({ project: rows[0] });
    }

    // ── Mark Paid ──────────────────────────────────────────────────
    if (sub === 'mark-paid') {
      const project_id = parseInt(searchParams.get('project_id') ?? '0');
      if (!project_id) return Response.json({ error: 'project_id required.' }, { status: 400 });
      const { rows } = await client.query(
        `UPDATE writing_project SET status='paid', paid_at=NOW() WHERE id=$1 RETURNING *`, [project_id]);
      if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
      return Response.json({ project: rows[0] });
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
      const { name, email, phone, company, industry, preferred_tone, preferred_style_guide,
        brand_voice_notes, target_audience, status, hourly_rate, source, notes } = b;
      const { rows } = await client.query(`
        UPDATE writing_client SET
          name=COALESCE($2,name), email=COALESCE($3,email), phone=COALESCE($4,phone),
          company=COALESCE($5,company), industry=COALESCE($6,industry),
          preferred_tone=COALESCE($7,preferred_tone), preferred_style_guide=COALESCE($8,preferred_style_guide),
          brand_voice_notes=COALESCE($9,brand_voice_notes), target_audience=COALESCE($10,target_audience),
          status=COALESCE($11,status), hourly_rate=COALESCE($12,hourly_rate),
          source=COALESCE($13,source), notes=COALESCE($14,notes)
        WHERE id=$1 RETURNING *
      `, [id, name||null, email||null, phone||null, company||null, industry||null,
          preferred_tone||null, preferred_style_guide||null, brand_voice_notes||null,
          target_audience||null, status||null, hourly_rate||null, source||null, notes||null]);
      if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: rows[0] });
    }

    if (sub === 'projects') {
      const { title, project_type, description, word_count_target, keywords, deadline,
        status, priority, rate_type, rate, estimated_fee, actual_fee, draft_due, final_due,
        revisions_allowed, brief_notes, research_notes, outline, platform, assigned_writer } = b;
      const { rows } = await client.query(`
        UPDATE writing_project SET
          title=COALESCE($2,title), project_type=COALESCE($3,project_type),
          description=COALESCE($4,description), word_count_target=COALESCE($5,word_count_target),
          keywords=COALESCE($6,keywords), deadline=COALESCE($7,deadline),
          status=COALESCE($8,status), priority=COALESCE($9,priority),
          rate_type=COALESCE($10,rate_type), rate=COALESCE($11,rate),
          estimated_fee=COALESCE($12,estimated_fee), actual_fee=COALESCE($13,actual_fee),
          draft_due=COALESCE($14,draft_due), final_due=COALESCE($15,final_due),
          revisions_allowed=COALESCE($16,revisions_allowed),
          brief_notes=COALESCE($17,brief_notes), research_notes=COALESCE($18,research_notes),
          outline=COALESCE($19,outline), platform=COALESCE($20,platform),
          assigned_writer=COALESCE($21,assigned_writer)
        WHERE id=$1 RETURNING *
      `, [id, title||null, project_type||null, description||null, word_count_target||null,
          keywords||null, deadline||null, status||null, priority||null, rate_type||null,
          rate||null, estimated_fee||null, actual_fee||null, draft_due||null, final_due||null,
          revisions_allowed||null, brief_notes||null, research_notes||null, outline||null,
          platform||null, assigned_writer||null]);
      if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
      return Response.json({ project: rows[0] });
    }

    return Response.json({ error: 'Unknown sub.' }, { status: 400 });
  } finally {
    client.release();
  }
}

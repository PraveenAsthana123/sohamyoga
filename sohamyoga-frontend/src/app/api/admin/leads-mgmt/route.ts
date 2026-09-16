import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email VARCHAR(200),
      phone VARCHAR(50),
      company VARCHAR(200),
      job_title VARCHAR(100),
      lead_source VARCHAR(50) DEFAULT 'website',
      lead_stage VARCHAR(30) DEFAULT 'new',
      lead_score INT DEFAULT 0,
      assigned_to VARCHAR(100),
      notes TEXT,
      tags TEXT,
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      last_contact_at TIMESTAMPTZ,
      expected_close_date DATE,
      deal_value DECIMAL(12,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lead_activity (
      id SERIAL PRIMARY KEY,
      lead_id INT REFERENCES lead(id) ON DELETE CASCADE,
      activity_type VARCHAR(30),
      description TEXT,
      outcome VARCHAR(100),
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lead_form (
      id SERIAL PRIMARY KEY,
      form_name VARCHAR(200),
      fields JSONB DEFAULT '[]',
      embed_code TEXT,
      source_page VARCHAR(300),
      submissions INT DEFAULT 0,
      conversions INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource') || 'leads';
  const stage = searchParams.get('stage') || '';
  const source = searchParams.get('source') || '';
  const search = searchParams.get('search') || '';
  const assignedTo = searchParams.get('assigned_to') || '';
  const minScore = parseInt(searchParams.get('min_score') || '0');
  const maxScore = parseInt(searchParams.get('max_score') || '100');

  if (resource === 'forms') {
    const result = await pool.query(`SELECT * FROM lead_form ORDER BY created_at DESC`);
    return Response.json({ forms: result.rows });
  }

  if (resource === 'analytics') {
    const [bySource, byStage, monthly, kpi] = await Promise.all([
      pool.query(`SELECT lead_source, COUNT(*)::int AS count, AVG(deal_value)::numeric(12,2) AS avg_deal FROM lead GROUP BY lead_source ORDER BY count DESC`),
      pool.query(`SELECT lead_stage, COUNT(*)::int AS count FROM lead GROUP BY lead_stage`),
      pool.query(`SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*)::int AS leads FROM lead WHERE created_at >= NOW() - INTERVAL '6 months' GROUP BY month ORDER BY month`),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE lead_stage='won')::int AS won, COALESCE(SUM(deal_value) FILTER (WHERE lead_stage='won'),0)::numeric(12,2) AS won_value, AVG(lead_score)::numeric(5,1) AS avg_score FROM lead`),
    ]);
    return Response.json({ bySource: bySource.rows, byStage: byStage.rows, monthly: monthly.rows, kpi: kpi.rows[0] });
  }

  // Leads list with filters
  const conditions: string[] = ['lead_score BETWEEN $1 AND $2'];
  const params: unknown[] = [minScore, maxScore];
  let idx = 3;

  if (stage) { conditions.push(`lead_stage = $${idx++}`); params.push(stage); }
  if (source) { conditions.push(`lead_source = $${idx++}`); params.push(source); }
  if (assignedTo) { conditions.push(`assigned_to = $${idx++}`); params.push(assignedTo); }
  if (search) {
    conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const result = await pool.query(
    `SELECT * FROM lead WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 500`,
    params,
  );

  const kpi = await pool.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lead_stage='new')::int AS new_leads,
      COUNT(*) FILTER (WHERE lead_stage='won')::int AS won,
      COUNT(*) FILTER (WHERE lead_stage='lost')::int AS lost,
      COALESCE(SUM(deal_value),0)::numeric(12,2) AS pipeline_value
    FROM lead
  `);

  return Response.json({ leads: result.rows, kpi: kpi.rows[0] });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const { action } = body as { action?: string };

  if (action === 'create-form') {
    const { form_name, fields, source_page } = body as { form_name?: string; fields?: unknown[]; source_page?: string };
    const embedCode = `<iframe src="/forms/${Date.now()}" width="100%" height="500" frameborder="0"></iframe>`;
    const result = await pool.query(
      `INSERT INTO lead_form (form_name, fields, embed_code, source_page) VALUES ($1,$2,$3,$4) RETURNING *`,
      [form_name, JSON.stringify(fields ?? []), embedCode, source_page],
    );
    return Response.json({ form: result.rows[0] });
  }

  if (action === 'recalculate-scores') {
    // Simple scoring: source weight + stage weight + deal value weight
    const sourceScores: Record<string, number> = {
      referral: 20, partner: 18, event: 15, campaign: 12, social: 10, website: 8, cold_outreach: 5,
    };
    const stageScores: Record<string, number> = {
      won: 15, negotiation: 12, proposal: 10, qualified: 8, contacted: 5, new: 2, lost: 0,
    };
    const leads = await pool.query(`SELECT id, lead_source, lead_stage, deal_value, last_contact_at FROM lead`);
    for (const lead of leads.rows as { id: number; lead_source: string; lead_stage: string; deal_value: string; last_contact_at: string }[]) {
      const sourceScore = sourceScores[lead.lead_source] ?? 5;
      const stageScore = stageScores[lead.lead_stage] ?? 2;
      const dealScore = Math.min(20, Math.floor((parseFloat(lead.deal_value || '0') / 5000)));
      const recencyScore = lead.last_contact_at
        ? Math.max(0, 20 - Math.floor((Date.now() - new Date(lead.last_contact_at).getTime()) / (1000 * 60 * 60 * 24) / 3))
        : 5;
      const engagementScore = 30; // baseline
      const total = Math.min(100, sourceScore + stageScore + dealScore + recencyScore + engagementScore);
      await pool.query(`UPDATE lead SET lead_score=$1, updated_at=NOW() WHERE id=$2`, [total, lead.id]);
    }
    return Response.json({ recalculated: leads.rowCount });
  }

  // Create lead
  const {
    first_name, last_name, email, phone, company, job_title, lead_source,
    lead_stage, assigned_to, notes, tags, deal_value, expected_close_date,
    utm_source, utm_medium, utm_campaign,
  } = body as {
    first_name?: string; last_name?: string; email?: string; phone?: string;
    company?: string; job_title?: string; lead_source?: string; lead_stage?: string;
    assigned_to?: string; notes?: string; tags?: string; deal_value?: number;
    expected_close_date?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string;
  };

  const result = await pool.query(
    `INSERT INTO lead (first_name, last_name, email, phone, company, job_title, lead_source,
     lead_stage, assigned_to, notes, tags, deal_value, expected_close_date,
     utm_source, utm_medium, utm_campaign)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [first_name, last_name, email, phone, company, job_title, lead_source ?? 'website',
     lead_stage ?? 'new', assigned_to, notes, tags, deal_value, expected_close_date || null,
     utm_source, utm_medium, utm_campaign],
  );
  return Response.json({ lead: result.rows[0] });
}

export async function PATCH(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const fields = Object.keys(body);
  if (fields.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => body[f]);

  const result = await pool.query(
    `UPDATE lead SET ${setClauses}, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [parseInt(id), ...values],
  );
  return Response.json({ lead: result.rows[0] });
}

export async function DELETE(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  await pool.query(`DELETE FROM lead WHERE id=$1`, [parseInt(id)]);
  return Response.json({ deleted: true });
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulation (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        jurisdiction TEXT,
        category TEXT DEFAULT 'ai',
        effective_date DATE,
        compliance_deadline DATE,
        status TEXT DEFAULT 'monitoring',
        impact_level TEXT DEFAULT 'medium',
        description TEXT,
        key_requirements TEXT[],
        penalty_max TEXT,
        our_exposure TEXT,
        action_items TEXT[],
        owner TEXT,
        last_reviewed_at TIMESTAMPTZ,
        source_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(name)
      )
    `);

    await client.query(`
      INSERT INTO regulation
        (name, jurisdiction, category, effective_date, compliance_deadline, status, impact_level, description, key_requirements, penalty_max)
      VALUES
        ('EU AI Act','EU','ai','2024-08-01','2026-08-02','action_required','critical',
         'EU regulation on artificial intelligence',
         ARRAY['Transparency requirements for AI systems','Risk classification (unacceptable/high/limited/minimal)','Human oversight requirements','Technical documentation','Prohibited AI practices'],
         '€30M or 6% of global turnover'),
        ('GDPR','EU','privacy','2018-05-25',NULL,'compliant','high',
         'EU General Data Protection Regulation',
         ARRAY['Lawful basis for processing','Data subject rights (access/erasure/portability)','Privacy by design','Data breach notification within 72h','DPO requirement for certain activities'],
         '€20M or 4% of global turnover'),
        ('CCPA/CPRA','US-CA','privacy','2020-01-01',NULL,'monitoring','medium',
         'California Consumer Privacy Act',
         ARRAY['Right to know','Right to delete','Right to opt-out of sale','Non-discrimination','Annual cybersecurity audit'],
         '$7,500 per intentional violation'),
        ('NIST AI RMF','US','ai','2023-01-26',NULL,'monitoring','medium',
         'US National AI Risk Management Framework',
         ARRAY['Govern','Map','Measure','Manage'],
         'No penalty - voluntary framework'),
        ('Digital Markets Act','EU','marketing','2022-11-01','2024-03-07','monitoring','high',
         'EU regulation on large digital platforms',
         ARRAY['Fair access to platform data','Prohibition of self-preferencing','Interoperability requirements'],
         '10% of global annual turnover'),
        ('CAN-SPAM Act','US','marketing','2003-01-01',NULL,'compliant','low',
         'US email marketing law',
         ARRAY['Clear identification of commercial email','Opt-out mechanism','Physical mailing address','Honest subject lines'],
         '$51,744 per violation')
      ON CONFLICT (name) DO NOTHING
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable().catch(() => {});

  const client = await pool.connect();
  try {
    const regulations = await client.query(`
      SELECT * FROM regulation
      ORDER BY
        CASE impact_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        compliance_deadline ASC NULLS LAST
    `).catch(() => ({ rows: [] }));

    return Response.json({ regulations: regulations.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable().catch(() => {});

  const body = await req.json().catch(() => null);
  if (!body || !body.name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO regulation
        (name, jurisdiction, category, effective_date, compliance_deadline, status, impact_level, description, penalty_max, our_exposure, owner, source_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      body.name, body.jurisdiction || null, body.category || 'ai',
      body.effective_date || null, body.compliance_deadline || null,
      body.status || 'monitoring', body.impact_level || 'medium',
      body.description || null, body.penalty_max || null,
      body.our_exposure || null, body.owner || null,
      body.source_url || null,
    ]);
    return Response.json({ regulation: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || !body.id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE regulation SET
        status = COALESCE($2, status),
        impact_level = COALESCE($3, impact_level),
        action_items = COALESCE($4, action_items),
        owner = COALESCE($5, owner),
        our_exposure = COALESCE($6, our_exposure),
        compliance_deadline = COALESCE($7, compliance_deadline),
        last_reviewed_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      body.id, body.status || null, body.impact_level || null,
      body.action_items ? body.action_items : null,
      body.owner || null, body.our_exposure || null,
      body.compliance_deadline || null,
    ]);
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ regulation: result.rows[0] });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS competitor (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT,
      industry TEXT,
      description TEXT,
      founded_year INTEGER,
      employee_count TEXT,
      revenue_range TEXT,
      threat_level TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      tags TEXT[],
      notes TEXT,
      last_analyzed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS competitor_signal (
      id SERIAL PRIMARY KEY,
      competitor_id INTEGER REFERENCES competitor(id) ON DELETE CASCADE,
      signal_type TEXT,
      title TEXT NOT NULL,
      description TEXT,
      source_url TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      impact TEXT DEFAULT 'low',
      is_read BOOLEAN DEFAULT false
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTables();

  const result = await query(
    `SELECT c.*,
       COUNT(cs.id) FILTER (WHERE NOT cs.is_read) AS unread_signal_count
     FROM competitor c
     LEFT JOIN competitor_signal cs ON cs.competitor_id = c.id
     WHERE c.status != 'inactive'
     GROUP BY c.id
     ORDER BY c.threat_level DESC, c.created_at DESC`,
  );

  return Response.json({ competitors: result.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTables();

  const body = await req.json() as {
    name: string;
    website?: string;
    industry?: string;
    description?: string;
    founded_year?: number;
    employee_count?: string;
    revenue_range?: string;
    threat_level?: string;
    tags?: string[];
  };

  if (!body.name) return Response.json({ error: 'name is required' }, { status: 400 });

  const result = await query(
    `INSERT INTO competitor (name, website, industry, description, founded_year, employee_count, revenue_range, threat_level, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [body.name, body.website ?? null, body.industry ?? null, body.description ?? null,
     body.founded_year ?? null, body.employee_count ?? null, body.revenue_range ?? null,
     body.threat_level ?? 'medium', body.tags ?? null],
  );

  return Response.json({ competitor: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTables();

  const body = await req.json() as Record<string, unknown>;
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const allowed = ['name', 'website', 'industry', 'description', 'founded_year',
    'employee_count', 'revenue_range', 'threat_level', 'status', 'tags', 'notes', 'last_analyzed_at'];

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);

  const result = await query(
    `UPDATE competitor SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  if (!result.rows.length) return Response.json({ error: 'Competitor not found' }, { status: 404 });
  return Response.json({ competitor: result.rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTables();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const result = await query(
    `UPDATE competitor SET status = 'inactive' WHERE id = $1 RETURNING id`,
    [id],
  );

  if (!result.rows.length) return Response.json({ error: 'Competitor not found' }, { status: 404 });
  return Response.json({ success: true });
}

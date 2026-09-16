import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS contact (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      job_title TEXT,
      contact_type TEXT DEFAULT 'lead',
      status TEXT DEFAULT 'active',
      source TEXT,
      tags TEXT[],
      notes TEXT,
      last_contacted_at TIMESTAMPTZ,
      assigned_to TEXT,
      linkedin_url TEXT,
      website TEXT,
      country TEXT,
      city TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const conditions: string[] = ['status != \'inactive\''];
  const values: unknown[] = [];
  let idx = 1;

  if (type) { conditions.push(`contact_type = $${idx++}`); values.push(type); }
  if (status) { conditions.push(`status = $${idx++}`); values.push(status); }
  if (search) {
    conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT * FROM contact ${where} ORDER BY created_at DESC`,
    values,
  );

  return Response.json({ contacts: result.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    job_title?: string;
    contact_type?: string;
    source?: string;
    tags?: string[];
    notes?: string;
    assigned_to?: string;
    linkedin_url?: string;
    website?: string;
    country?: string;
    city?: string;
  };

  if (!body.first_name) return Response.json({ error: 'first_name is required' }, { status: 400 });

  const result = await query(
    `INSERT INTO contact (first_name, last_name, email, phone, company, job_title, contact_type, source, tags, notes, assigned_to, linkedin_url, website, country, city)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [body.first_name, body.last_name ?? null, body.email ?? null, body.phone ?? null,
     body.company ?? null, body.job_title ?? null, body.contact_type ?? 'lead',
     body.source ?? null, body.tags ?? null, body.notes ?? null,
     body.assigned_to ?? null, body.linkedin_url ?? null, body.website ?? null,
     body.country ?? null, body.city ?? null],
  );

  return Response.json({ contact: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as Record<string, unknown>;

  const { id, ...fields } = body;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const allowed = ['first_name', 'last_name', 'email', 'phone', 'company', 'job_title',
    'contact_type', 'status', 'source', 'tags', 'notes', 'assigned_to',
    'linkedin_url', 'website', 'country', 'city', 'last_contacted_at'];

  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  values.push(id);

  const result = await query(
    `UPDATE contact SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  if (!result.rows.length) return Response.json({ error: 'Contact not found' }, { status: 404 });
  return Response.json({ contact: result.rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const result = await query(
    `UPDATE contact SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id],
  );

  if (!result.rows.length) return Response.json({ error: 'Contact not found' }, { status: 404 });
  return Response.json({ success: true });
}

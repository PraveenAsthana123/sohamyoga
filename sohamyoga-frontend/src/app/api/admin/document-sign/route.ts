import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS document_signature (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES document(id) ON DELETE CASCADE,
      signer_name TEXT NOT NULL,
      signer_email TEXT NOT NULL,
      signer_role TEXT,
      status TEXT DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      signed_at TIMESTAMPTZ,
      declined_reason TEXT,
      signature_token TEXT UNIQUE,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`ds.status = $${idx++}`); values.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT ds.*, d.title AS document_title
     FROM document_signature ds
     JOIN document d ON ds.document_id = d.id
     ${where}
     ORDER BY ds.created_at DESC`,
    values,
  );

  return Response.json({ signatures: result.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as {
    document_id: number;
    signer_name: string;
    signer_email: string;
    signer_role?: string;
  };

  if (!body.document_id || !body.signer_name || !body.signer_email) {
    return Response.json({ error: 'document_id, signer_name, and signer_email are required' }, { status: 400 });
  }

  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const result = await query(
    `INSERT INTO document_signature (document_id, signer_name, signer_email, signer_role, signature_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [body.document_id, body.signer_name, body.signer_email, body.signer_role ?? null, token],
  );

  return Response.json({ signature: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as {
    id: number;
    status?: string;
    declined_reason?: string;
    ip_address?: string;
  };

  if (!body.id) return Response.json({ error: 'id is required' }, { status: 400 });

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.status !== undefined) {
    sets.push(`status = $${idx++}`);
    values.push(body.status);

    if (body.status === 'sent') { sets.push(`sent_at = NOW()`); }
    if (body.status === 'viewed') { sets.push(`viewed_at = NOW()`); }
    if (body.status === 'signed') { sets.push(`signed_at = NOW()`); }
  }
  if (body.declined_reason !== undefined) { sets.push(`declined_reason = $${idx++}`); values.push(body.declined_reason); }
  if (body.ip_address !== undefined) { sets.push(`ip_address = $${idx++}`); values.push(body.ip_address); }

  if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

  values.push(body.id);

  const result = await query(
    `UPDATE document_signature SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  if (!result.rows.length) return Response.json({ error: 'Signature request not found' }, { status: 404 });
  return Response.json({ signature: result.rows[0] });
}

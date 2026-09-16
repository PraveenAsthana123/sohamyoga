import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT,
        contract_type TEXT DEFAULT 'service',
        status TEXT DEFAULT 'draft',
        value_cad NUMERIC(12,2),
        start_date DATE,
        end_date DATE,
        content_html TEXT,
        signed_at TIMESTAMPTZ,
        pdf_url TEXT,
        notes TEXT,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(`SELECT COUNT(*) AS cnt FROM contracts WHERE deleted_at IS NULL`);
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO contracts (title, client_name, client_email, contract_type, status, value_cad, start_date, end_date, content_html)
        VALUES
          ('Annual Marketing Retainer', 'Sunrise Wellness Ltd', 'billing@sunrisewellness.ca', 'retainer', 'signed', 18000.00, '2026-01-01', '2026-12-31',
           '<h2>Annual Marketing Retainer Agreement</h2><p>This agreement is between Soham Yoga and Sunrise Wellness Ltd for ongoing digital marketing services valued at CAD 18,000 for the calendar year 2026.</p>'),
          ('Brand Strategy Project', 'Lakeside Studios', 'studio@lakeside.ca', 'project', 'sent', 5500.00, '2026-09-01', '2026-11-30',
           '<h2>Brand Strategy Project</h2><p>Scope includes brand audit, visual identity refresh, and messaging framework for Lakeside Studios.</p>'),
          ('NDA — Content Collaboration', 'Mindful Media Inc', 'legal@mindfulmedia.ca', 'nda', 'draft', NULL, '2026-09-15', NULL,
           '<h2>Non-Disclosure Agreement</h2><p>This NDA governs the exchange of confidential information between the parties in connection with a potential content collaboration.</p>')
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, title, client_name, client_email, contract_type, status,
             value_cad, start_date, end_date, signed_at, pdf_url, created_at, notes
      FROM contracts
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    return Response.json({ contracts: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json().catch(() => null) as {
    title?: string; client_name?: string; client_email?: string;
    contract_type?: string; value_cad?: number; start_date?: string;
    end_date?: string; content_html?: string; notes?: string;
  } | null;

  if (!body?.title || !body?.client_name) {
    return Response.json({ error: 'title and client_name are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO contracts (title, client_name, client_email, contract_type, value_cad, start_date, end_date, content_html, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.title, body.client_name, body.client_email || null,
      body.contract_type || 'service', body.value_cad || null,
      body.start_date || null, body.end_date || null,
      body.content_html || null, body.notes || null,
    ]);
    return Response.json({ contract: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

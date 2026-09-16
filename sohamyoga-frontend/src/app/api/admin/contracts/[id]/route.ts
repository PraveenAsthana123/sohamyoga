import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM contracts WHERE id = $1 AND deleted_at IS NULL`,
      [params.id],
    );
    if (!rows.length) return Response.json({ error: 'Contract not found.' }, { status: 404 });
    return Response.json({ contract: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    status?: string; signed_at?: string | null; pdf_url?: string | null;
    notes?: string | null; content_html?: string | null;
    title?: string; client_name?: string; client_email?: string;
    contract_type?: string; value_cad?: number | null;
    start_date?: string | null; end_date?: string | null;
  } | null;

  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      UPDATE contracts SET
        status        = COALESCE($2, status),
        signed_at     = CASE WHEN $3::TEXT IS NOT NULL THEN $3::TIMESTAMPTZ ELSE signed_at END,
        pdf_url       = COALESCE($4, pdf_url),
        notes         = COALESCE($5, notes),
        content_html  = COALESCE($6, content_html),
        title         = COALESCE($7, title),
        client_name   = COALESCE($8, client_name),
        client_email  = COALESCE($9, client_email),
        contract_type = COALESCE($10, contract_type),
        value_cad     = COALESCE($11, value_cad),
        start_date    = COALESCE($12::DATE, start_date),
        end_date      = COALESCE($13::DATE, end_date),
        updated_at    = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `, [
      params.id,
      body.status ?? null,
      body.signed_at ?? null,
      body.pdf_url ?? null,
      body.notes ?? null,
      body.content_html ?? null,
      body.title ?? null,
      body.client_name ?? null,
      body.client_email ?? null,
      body.contract_type ?? null,
      body.value_cad ?? null,
      body.start_date ?? null,
      body.end_date ?? null,
    ]);
    if (!rows.length) return Response.json({ error: 'Contract not found.' }, { status: 404 });
    return Response.json({ contract: rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE contracts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [params.id],
    );
    if (!rowCount) return Response.json({ error: 'Contract not found.' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}

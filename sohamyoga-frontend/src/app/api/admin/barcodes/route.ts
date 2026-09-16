import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS barcode (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    barcode_type TEXT DEFAULT 'QR',
    entity_type TEXT DEFAULT 'product',
    entity_id INTEGER,
    entity_ref TEXT,
    label TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMPTZ,
    url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS barcode_scan_log (
    id BIGSERIAL PRIMARY KEY,
    barcode_id INTEGER REFERENCES barcode(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    scan_source TEXT DEFAULT 'app',
    location TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'
  );
`;

function generateBarcodeCode(type: string, entityRef?: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  if (entityRef) return `${entityRef.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)}-${rand().substring(0, 4)}`;
  if (type === 'EAN13') return String(Math.floor(1000000000000 + Math.random() * 9000000000000));
  if (type === 'EAN8') return String(Math.floor(10000000 + Math.random() * 90000000));
  if (type === 'UPC_A') return String(Math.floor(100000000000 + Math.random() * 900000000000));
  return rand();
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLES);
    const [barcodes, scanLogs] = await Promise.all([
      client.query(`SELECT * FROM barcode ORDER BY created_at DESC LIMIT 500`),
      client.query(`
        SELECT sl.*, b.code AS barcode_code, b.label AS barcode_label
        FROM barcode_scan_log sl
        JOIN barcode b ON b.id = sl.barcode_id
        ORDER BY sl.scanned_at DESC LIMIT 500
      `),
    ]);
    return Response.json({ barcodes: barcodes.rows, scan_logs: scanLogs.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const {
    code: rawCode, barcode_type = 'QR', entity_type = 'product',
    entity_id, entity_ref, label, description, url: rawUrl, metadata
  } = body as Record<string, unknown>;

  const code = rawCode && typeof rawCode === 'string' && rawCode.trim()
    ? rawCode.trim().toUpperCase()
    : generateBarcodeCode(String(barcode_type), entity_ref as string | undefined);

  const url = rawUrl ?? (barcode_type === 'QR' ? `/scan/${code}` : null);

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLES);
    const result = await client.query(
      `INSERT INTO barcode (code, barcode_type, entity_type, entity_id, entity_ref, label, description, url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [code, barcode_type, entity_type, entity_id ?? null, entity_ref ?? null,
       label ?? null, description ?? null, url ?? null, JSON.stringify(metadata ?? {})]
    );
    return Response.json({ barcode: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') return Response.json({ error: 'Barcode code already exists.' }, { status: 409 });
    throw err;
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { id, label, description, is_active } = body as Record<string, unknown>;
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const sets: string[] = [];
  const values: unknown[] = [];
  if (label !== undefined) { sets.push(`label = $${values.length + 1}`); values.push(label); }
  if (description !== undefined) { sets.push(`description = $${values.length + 1}`); values.push(description); }
  if (is_active !== undefined) { sets.push(`is_active = $${values.length + 1}`); values.push(is_active); }
  if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

  values.push(id);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE barcode SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) return Response.json({ error: 'Barcode not found.' }, { status: 404 });
    return Response.json({ barcode: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE barcode SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) return Response.json({ error: 'Barcode not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}

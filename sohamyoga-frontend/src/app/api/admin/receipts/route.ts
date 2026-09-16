import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS receipt (
    id SERIAL PRIMARY KEY,
    receipt_number TEXT,
    vendor_name TEXT,
    vendor_address TEXT,
    receipt_date DATE,
    total_amount NUMERIC,
    tax_amount NUMERIC DEFAULT 0,
    subtotal NUMERIC,
    currency TEXT DEFAULT 'USD',
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    file_name TEXT,
    file_url TEXT,
    ocr_raw_text TEXT,
    extracted_data JSONB DEFAULT '{}',
    notes TEXT,
    uploaded_by TEXT,
    department TEXT,
    project TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const category = searchParams.get('category') ?? '';
  const department = searchParams.get('department') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) { conditions.push(`status = $${values.length + 1}`); values.push(status); }
    if (category) { conditions.push(`category = $${values.length + 1}`); values.push(category); }
    if (department) { conditions.push(`department = $${values.length + 1}`); values.push(department); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT * FROM receipt ${where} ORDER BY created_at DESC LIMIT 500`,
      values
    );
    return Response.json({ receipts: result.rows });
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
    receipt_number, vendor_name, vendor_address, receipt_date, total_amount, tax_amount,
    subtotal, currency = 'USD', category = 'general', status = 'pending', file_name,
    ocr_raw_text: providedOcr, notes, uploaded_by, department, project
  } = body as Record<string, unknown>;

  // Simulate OCR for image files
  let ocr_raw_text = providedOcr as string | null;
  if (!ocr_raw_text && typeof file_name === 'string' && /\.(jpg|jpeg|png)$/i.test(file_name)) {
    ocr_raw_text = `RECEIPT\nVendor: ${vendor_name ?? 'Unknown'}\nDate: ${receipt_date ?? 'N/A'}\nTotal: $${total_amount ?? '0.00'}\nThank you for your purchase.`;
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const result = await client.query(
      `INSERT INTO receipt (receipt_number, vendor_name, vendor_address, receipt_date, total_amount,
        tax_amount, subtotal, currency, category, status, file_name, ocr_raw_text, notes,
        uploaded_by, department, project)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [receipt_number, vendor_name, vendor_address, receipt_date, total_amount,
       tax_amount ?? 0, subtotal, currency, category, status, file_name, ocr_raw_text, notes,
       uploaded_by, department, project]
    );
    return Response.json({ receipt: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { id, status, extracted_data, notes, category } = body as Record<string, unknown>;
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (status !== undefined) { sets.push(`status = $${values.length + 1}`); values.push(status); }
    if (extracted_data !== undefined) { sets.push(`extracted_data = $${values.length + 1}`); values.push(JSON.stringify(extracted_data)); }
    if (notes !== undefined) { sets.push(`notes = $${values.length + 1}`); values.push(notes); }
    if (category !== undefined) { sets.push(`category = $${values.length + 1}`); values.push(category); }
    if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

    values.push(id);
    const result = await client.query(
      `UPDATE receipt SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) return Response.json({ error: 'Receipt not found.' }, { status: 404 });
    return Response.json({ receipt: result.rows[0] });
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
      `UPDATE receipt SET status = 'archived' WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) return Response.json({ error: 'Receipt not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public endpoint — no admin auth required
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const { id } = params;
  if (!id || isNaN(Number(id))) return Response.json({ error: 'Valid id required.' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const scan_source = (body.scan_source as string) ?? 'app';
  const location = (body.location as string) ?? null;
  const ip_address = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;

  const client = await pool.connect();
  try {
    const row = await client.query(`SELECT id FROM barcode WHERE id = $1 AND is_active = true`, [id]);
    if (!row.rowCount) return Response.json({ error: 'Barcode not found or inactive.' }, { status: 404 });

    await Promise.all([
      client.query(
        `UPDATE barcode SET scan_count = scan_count + 1, last_scanned_at = NOW() WHERE id = $1`,
        [id]
      ),
      client.query(
        `INSERT INTO barcode_scan_log (barcode_id, scan_source, location, ip_address) VALUES ($1,$2,$3,$4)`,
        [id, scan_source, location, ip_address]
      ),
    ]);

    return Response.json({ ok: true, scanned_at: new Date().toISOString() });
  } finally {
    client.release();
  }
}

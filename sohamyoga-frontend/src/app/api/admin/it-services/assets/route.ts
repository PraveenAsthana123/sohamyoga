import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const warrantyExpiring = searchParams.get('warranty_expiring');
  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (clientId) { conditions.push(`a.client_id=$${vals.length + 1}`); vals.push(clientId); }
  if (warrantyExpiring === 'true') { conditions.push(`a.warranty_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE+90`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT a.*, c.name AS client_name FROM it_asset a LEFT JOIN it_client c ON c.id=a.client_id ${where} ORDER BY a.warranty_expiry NULLS LAST`,
      vals
    );
    return Response.json({ assets: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.asset_type) return Response.json({ error: 'client_id and asset_type are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO it_asset (client_id, asset_type, make, model, serial_number, assigned_to_user, location, purchase_date, warranty_expiry, os, os_version, last_patch_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [body.client_id, body.asset_type, body.make, body.model, body.serial_number, body.assigned_to_user, body.location, body.purchase_date, body.warranty_expiry, body.os, body.os_version, body.last_patch_date, body.status ?? 'active', body.notes]
    );
    return Response.json({ asset: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

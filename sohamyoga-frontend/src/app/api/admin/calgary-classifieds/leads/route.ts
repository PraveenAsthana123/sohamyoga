import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const listing_id = url.searchParams.get('listing_id') || '';
  const platform = url.searchParams.get('platform') || '';
  const status = url.searchParams.get('status') || '';

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (listing_id) { conditions.push(`l.listing_id = $${idx++}`); values.push(Number(listing_id)); }
  if (platform) { conditions.push(`l.platform = $${idx++}`); values.push(platform); }
  if (status) { conditions.push(`l.status = $${idx++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT l.*, cl.title AS listing_title
      FROM calgary_classifieds_lead l
      LEFT JOIN calgary_listing cl ON cl.id = l.listing_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT 500
    `, values);
    return Response.json({ leads: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const { listing_id, platform, name, email, phone, message } = body as Record<string, unknown>;
  if (!listing_id) return Response.json({ error: 'listing_id required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      INSERT INTO calgary_classifieds_lead (listing_id, platform, name, email, phone, message)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [listing_id, platform ?? null, name ?? null, email ?? null, phone ?? null, message ?? null]);
    return Response.json({ lead: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const { id, status } = body as Record<string, unknown>;
  if (!id || !status) return Response.json({ error: 'id and status required.' }, { status: 400 });

  const validStatuses = ['new','contacted','qualified','converted','lost'];
  if (!validStatuses.includes(status as string)) return Response.json({ error: 'Invalid status.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE calgary_classifieds_lead SET status=$2 WHERE id=$1 RETURNING *`,
      [id, status]
    );
    if (!res.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ lead: res.rows[0] });
  } finally {
    client.release();
  }
}

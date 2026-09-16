import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return Response.json({ error: 'Invalid listing ID.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [listingRes, platformsRes, leadsRes] = await Promise.all([
      client.query(
        `SELECT *, EXTRACT(DAY FROM NOW() - listed_at)::INT AS days_on_market
         FROM real_estate_listing WHERE id = $1`,
        [listingId]
      ),
      client.query(
        `SELECT * FROM real_estate_platform WHERE listing_id = $1 ORDER BY platform`,
        [listingId]
      ),
      client.query(
        `SELECT * FROM real_estate_lead WHERE listing_id = $1 ORDER BY created_at DESC`,
        [listingId]
      ),
    ]);

    if (!listingRes.rows.length) return Response.json({ error: 'Listing not found.' }, { status: 404 });

    return Response.json({
      listing: listingRes.rows[0],
      platforms: platformsRes.rows,
      leads: leadsRes.rows,
    });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return Response.json({ error: 'Invalid listing ID.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const allowed = [
    'mls_number', 'listing_type', 'property_type', 'title', 'address', 'city', 'province',
    'postal_code', 'neighbourhood', 'price', 'bedrooms', 'bathrooms', 'sq_ft', 'lot_size',
    'year_built', 'garage', 'basement', 'description', 'features', 'images',
    'virtual_tour_url', 'open_house_dates', 'listing_agent', 'brokerage',
    'commission_pct', 'status', 'listed_at', 'sold_at', 'sold_price',
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      if (key === 'features' && Array.isArray(body[key])) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(`{${(body[key] as string[]).map(f => `"${f.replace(/"/g, '\\"')}"`).join(',')}}`);
      } else if (key === 'images' && Array.isArray(body[key])) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(`{${(body[key] as string[]).map(i => `"${i.replace(/"/g, '\\"')}"`).join(',')}}`);
      } else if (key === 'open_house_dates') {
        setClauses.push(`${key} = $${idx++}`);
        values.push(JSON.stringify(body[key]));
      } else {
        setClauses.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }
  }

  if (!setClauses.length) return Response.json({ error: 'No valid fields to update.' }, { status: 400 });

  values.push(listingId);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE real_estate_listing SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!res.rows.length) return Response.json({ error: 'Listing not found.' }, { status: 404 });
    return Response.json({ listing: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return Response.json({ error: 'Invalid listing ID.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE real_estate_listing SET status = 'withdrawn' WHERE id = $1 RETURNING id`,
      [listingId]
    );
    if (!res.rows.length) return Response.json({ error: 'Listing not found.' }, { status: 404 });
    return Response.json({ ok: true, id: listingId, status: 'withdrawn' });
  } finally {
    client.release();
  }
}

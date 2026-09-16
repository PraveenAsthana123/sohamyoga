import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM kijiji_listings WHERE id = $1 AND status != 'deleted'`,
      [id],
    );
    if (!result.rowCount) return Response.json({ error: 'Listing not found' }, { status: 404 });
    return Response.json({ listing: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    title?: string; category?: string; subcategory?: string;
    price?: number; price_type?: string; description?: string;
    location_city?: string; location_province?: string;
    images?: string[]; contact_method?: string; phone?: string;
    status?: string; kijiji_url?: string; kijiji_ad_id?: string;
    views_count?: number; responses_count?: number;
    tags?: string[]; auto_renew?: boolean;
  } | null;

  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields: Record<string, unknown> = {
      title: body.title, category: body.category, subcategory: body.subcategory,
      price: body.price, price_type: body.price_type, description: body.description,
      location_city: body.location_city, location_province: body.location_province,
      images: body.images, contact_method: body.contact_method, phone: body.phone,
      status: body.status, kijiji_url: body.kijiji_url, kijiji_ad_id: body.kijiji_ad_id,
      views_count: body.views_count, responses_count: body.responses_count,
      tags: body.tags, auto_renew: body.auto_renew,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE kijiji_listings SET ${sets.join(', ')} WHERE id = $${idx} AND status != 'deleted' RETURNING *`,
      values,
    );
    if (!result.rowCount) return Response.json({ error: 'Listing not found' }, { status: 404 });
    return Response.json({ listing: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE kijiji_listings SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND status != 'deleted' RETURNING id`,
      [id],
    );
    if (!result.rowCount) return Response.json({ error: 'Listing not found' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}

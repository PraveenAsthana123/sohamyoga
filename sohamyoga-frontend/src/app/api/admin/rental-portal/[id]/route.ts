import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const listingRes = await client.query(
      `SELECT * FROM rental_listing WHERE id = $1`,
      [id],
    );
    if (!listingRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const platformRes = await client.query(
      `SELECT * FROM rental_platform WHERE listing_id = $1 ORDER BY platform`,
      [id],
    );
    const appRes = await client.query(
      `SELECT * FROM rental_application WHERE listing_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    const tenantRes = await client.query(
      `SELECT * FROM rental_tenant WHERE listing_id = $1 ORDER BY lease_start DESC`,
      [id],
    );

    return Response.json({
      listing: listingRes.rows[0],
      platforms: platformRes.rows,
      applications: appRes.rows,
      tenants: tenantRes.rows,
    });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const fields = Object.keys(body).filter(
      (k) => !['id', 'created_at'].includes(k),
    );
    if (!fields.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => body[f]);

    const res = await client.query(
      `UPDATE rental_listing SET ${sets} WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    if (!res.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ listing: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Soft delete — set status to expired
    const res = await client.query(
      `UPDATE rental_listing SET status = 'expired' WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!res.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ success: true, id: res.rows[0].id });
  } finally {
    client.release();
  }
}

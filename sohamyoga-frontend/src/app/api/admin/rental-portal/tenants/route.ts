import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const listing_id = searchParams.get('listing_id');
  const status     = searchParams.get('status');
  const expiring   = searchParams.get('expiring'); // "60" days

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (expiring) {
      const days = parseInt(expiring, 10) || 60;
      const res = await client.query(
        `SELECT t.*, l.address, l.neighbourhood
         FROM rental_tenant t
         LEFT JOIN rental_listing l ON l.id = t.listing_id
         WHERE t.status = 'active'
           AND t.lease_end IS NOT NULL
           AND t.lease_end BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
         ORDER BY t.lease_end ASC`,
      );
      return Response.json({ tenants: res.rows });
    }

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let p = 1;

    if (listing_id) { conditions.push(`t.listing_id = $${p++}`); params.push(Number(listing_id)); }
    if (status)     { conditions.push(`t.status = $${p++}`);      params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await client.query(
      `SELECT t.*, l.address, l.neighbourhood, l.rental_type
       FROM rental_tenant t
       LEFT JOIN rental_listing l ON l.id = t.listing_id
       ${where}
       ORDER BY t.lease_start DESC`,
      params,
    );

    // Rent roll total
    const rollRes = await client.query(
      `SELECT COALESCE(SUM(monthly_rent), 0) AS rent_roll
       FROM rental_tenant
       WHERE status = 'active'`,
    );

    return Response.json({
      tenants: res.rows,
      rent_roll: Number(rollRes.rows[0].rent_roll),
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO rental_tenant (
        listing_id, name, email, phone,
        lease_start, lease_end, monthly_rent, deposit_paid, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        body.listing_id ?? null,
        body.name,
        body.email ?? null,
        body.phone ?? null,
        body.lease_start ?? null,
        body.lease_end ?? null,
        body.monthly_rent ?? null,
        body.deposit_paid ?? null,
        body.status ?? 'active',
        body.notes ?? null,
      ],
    );
    return Response.json({ tenant: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

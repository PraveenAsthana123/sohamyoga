import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const listing_id = url.searchParams.get('listing_id');
  const platform = url.searchParams.get('platform');
  const status = url.searchParams.get('status');
  const lead_type = url.searchParams.get('lead_type');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (listing_id) { conditions.push(`rl.listing_id = $${idx++}`); values.push(parseInt(listing_id, 10)); }
  if (platform) { conditions.push(`rl.platform = $${idx++}`); values.push(platform); }
  if (status) { conditions.push(`rl.status = $${idx++}`); values.push(status); }
  if (lead_type) { conditions.push(`rl.lead_type = $${idx++}`); values.push(lead_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT rl.*, l.title AS listing_title, l.address AS listing_address, l.price AS listing_price
       FROM real_estate_lead rl
       LEFT JOIN real_estate_listing l ON l.id = rl.listing_id
       ${where}
       ORDER BY rl.created_at DESC
       LIMIT 500`,
      values
    );

    const statsRes = await client.query(
      `SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE lead_type = 'inquiry')::INT AS inquiries,
        COUNT(*) FILTER (WHERE lead_type = 'showing_request')::INT AS showings,
        COUNT(*) FILTER (WHERE lead_type = 'offer')::INT AS offers,
        COUNT(*) FILTER (WHERE lead_type = 'pre_approval')::INT AS pre_approvals,
        COUNT(*) FILTER (WHERE status = 'new')::INT AS new_leads,
        COUNT(*) FILTER (WHERE status = 'converted')::INT AS converted,
        COUNT(*) FILTER (WHERE pre_approved = true)::INT AS pre_approved_count
       FROM real_estate_lead`
    );

    return Response.json({ leads: res.rows, stats: statsRes.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const {
    listing_id, platform, name, email, phone, message,
    lead_type, status, budget, pre_approved, notes,
  } = body as Record<string, unknown>;

  if (!name) return Response.json({ error: 'name is required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO real_estate_lead
        (listing_id, platform, name, email, phone, message, lead_type, status, budget, pre_approved, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        listing_id ? parseInt(String(listing_id), 10) : null,
        platform || null, name, email || null, phone || null,
        message || null, lead_type || 'inquiry', status || 'new',
        budget ? Number(budget) : null, pre_approved === true, notes || null,
      ]
    );
    return Response.json({ lead: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

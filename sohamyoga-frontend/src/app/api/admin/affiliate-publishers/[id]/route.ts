import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const [publisherRes, appsRes] = await Promise.all([
      pool.query(`SELECT * FROM affiliate_publishers WHERE id=$1`, [params.id]),
      pool.query(`SELECT * FROM publisher_applications WHERE publisher_id=$1 ORDER BY created_at DESC`, [params.id]),
    ]);
    if (!publisherRes.rows.length) return Response.json({ error: 'Publisher not found' }, { status: 404 });
    return Response.json({ publisher: publisherRes.rows[0], applications: appsRes.rows });
  } catch (err) {
    console.error('affiliate-publishers [id] GET error:', err);
    return Response.json({ error: 'Failed to load publisher' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const allowed = ['contact_name', 'company_name', 'contact_email', 'contact_phone', 'website_url', 'social_profiles', 'publisher_type', 'niche', 'audience_size', 'monthly_traffic', 'geo_focus', 'proposed_commission_pct', 'status', 'tier', 'performance_score', 'notes', 'recruited_by'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
      if (allowed.includes(key) && val !== undefined) {
        values.push(key === 'social_profiles' ? JSON.stringify(val) : val);
        setClauses.push(`${key}=$${values.length}`);
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    values.push(params.id);
    const { rows } = await pool.query(
      `UPDATE affiliate_publishers SET ${setClauses.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return Response.json({ error: 'Publisher not found' }, { status: 404 });
    return Response.json({ publisher: rows[0] });
  } catch (err) {
    console.error('affiliate-publishers [id] PATCH error:', err);
    return Response.json({ error: 'Failed to update publisher' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const { rowCount } = await pool.query(`DELETE FROM affiliate_publishers WHERE id=$1`, [params.id]);
    if (!rowCount) return Response.json({ error: 'Publisher not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('affiliate-publishers [id] DELETE error:', err);
    return Response.json({ error: 'Failed to delete publisher' }, { status: 500 });
  }
}

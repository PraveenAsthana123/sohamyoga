import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { kijiji_url?: string; kijiji_ad_id?: string };

  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets = [
      `status = 'posted'`,
      `posted_at = NOW()`,
      `expires_at = NOW() + INTERVAL '30 days'`,
      `updated_at = NOW()`,
    ];
    const values: unknown[] = [];
    let idx = 1;

    if (body.kijiji_url) {
      sets.push(`kijiji_url = $${idx++}`);
      values.push(body.kijiji_url);
    }
    if (body.kijiji_ad_id) {
      sets.push(`kijiji_ad_id = $${idx++}`);
      values.push(body.kijiji_ad_id);
    }
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

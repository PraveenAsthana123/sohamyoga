import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

function assignTier(audienceSize: number | null): string {
  if (!audienceSize) return 'bronze';
  if (audienceSize < 10_000) return 'bronze';
  if (audienceSize < 100_000) return 'silver';
  if (audienceSize < 1_000_000) return 'gold';
  return 'platinum';
}

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const { rows: current } = await pool.query(`SELECT * FROM affiliate_publishers WHERE id=$1`, [params.id]);
    if (!current.length) return Response.json({ error: 'Publisher not found' }, { status: 404 });
    const pub = current[0];
    const tier = assignTier(pub.audience_size);
    const { rows } = await pool.query(`
      UPDATE affiliate_publishers SET
        status = 'approved',
        tier = $2,
        approved_at = NOW()
      WHERE id = $1 RETURNING *
    `, [params.id, tier]);

    // Also approve any pending applications
    await pool.query(`
      UPDATE publisher_applications SET status='approved', reviewed_at=NOW()
      WHERE publisher_id=$1 AND status='pending'
    `, [params.id]);

    return Response.json({ publisher: rows[0], tier, message: `Publisher approved with ${tier} tier` });
  } catch (err) {
    console.error('affiliate-publishers approve POST error:', err);
    return Response.json({ error: 'Failed to approve publisher' }, { status: 500 });
  }
}

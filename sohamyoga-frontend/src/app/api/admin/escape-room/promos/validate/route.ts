import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { code } = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await client.query(
      `SELECT * FROM er_promo WHERE code=$1 AND is_active=true
         AND (valid_from IS NULL OR valid_from<=$2)
         AND (valid_until IS NULL OR valid_until>=$2)`,
      [code?.toUpperCase(), today]
    );
    if (!r.rows.length) return Response.json({ valid: false, error: 'Promo code not found or expired' });

    const promo = r.rows[0];
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return Response.json({ valid: false, error: 'Promo code has reached maximum uses' });
    }
    return Response.json({ valid: true, promo });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.code) return Response.json({ error: 'Code required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT id, code, recipient_name, remaining_balance, expiry_date, is_active
        FROM spa_gift_card WHERE code=$1
      `, [body.code.toUpperCase().trim()]);
      if (!rows[0]) return Response.json({ valid: false, error: 'Gift card not found' });
      const gc = rows[0];
      if (!gc.is_active) return Response.json({ valid: false, error: 'Gift card is inactive or fully redeemed', remaining_balance: 0 });
      if (gc.expiry_date && new Date(gc.expiry_date) < new Date()) {
        return Response.json({ valid: false, error: 'Gift card has expired', remaining_balance: parseFloat(gc.remaining_balance) });
      }
      return Response.json({
        valid: true,
        id: gc.id,
        code: gc.code,
        recipient_name: gc.recipient_name,
        remaining_balance: parseFloat(gc.remaining_balance),
        expiry_date: gc.expiry_date,
      });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

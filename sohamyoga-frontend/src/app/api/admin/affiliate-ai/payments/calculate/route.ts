export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: pending } = await client.query(`SELECT * FROM affiliate_payments WHERE status='pending'`);
    const total = pending.reduce((s, p) => s + Number(p.amount), 0);
    return Response.json({
      pending_count: pending.length,
      total_payout: total,
      by_method: pending.reduce((acc: Record<string, number>, p) => {
        const m = p.payment_method || 'unknown';
        acc[m] = (acc[m] || 0) + Number(p.amount);
        return acc;
      }, {}),
      payments: pending,
      calculated_at: new Date().toISOString(),
    });
  } finally { client.release(); }
}

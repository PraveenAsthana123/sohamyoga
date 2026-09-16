import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateCode(prefix = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const base = prefix.toUpperCase();
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return (base + suffix).substring(0, Math.max(8, base.length + 4));
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { count, prefix = '', discount_type = 'percentage', discount_value, valid_until } = body as Record<string, unknown>;

  const n = typeof count === 'number' ? Math.min(Math.max(1, Math.floor(count)), 100) : 0;
  if (!n) return Response.json({ error: 'count must be 1-100.' }, { status: 400 });
  if (discount_value === undefined) return Response.json({ error: 'discount_value required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    const codes: string[] = [];
    const created: unknown[] = [];

    for (let i = 0; i < n; i++) {
      let code = '';
      let attempts = 0;
      // Ensure uniqueness within this batch
      do {
        code = generateCode(typeof prefix === 'string' ? prefix : '');
        attempts++;
      } while (codes.includes(code) && attempts < 20);
      codes.push(code);
    }

    for (const code of codes) {
      try {
        const r = await client.query(
          `INSERT INTO coupon (code, coupon_type, discount_type, discount_value, valid_until, created_by)
           VALUES ($1, 'multi_use', $2, $3, $4, 'bulk-generate') RETURNING *`,
          [code, discount_type, discount_value, valid_until ?? null]
        );
        created.push(r.rows[0]);
      } catch {
        // Skip duplicates
      }
    }

    return Response.json({ ok: true, generated: created.length, coupons: created });
  } finally {
    client.release();
  }
}

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Discount { type: 'percentage' | 'fixed_amount' | 'free_units'; value: number; currency?: string }

function formatDiscount(d: Discount): string {
  if (d.type === 'percentage') return `${d.value}%`;
  if (d.type === 'fixed_amount') return `${d.currency ?? 'CAD'} ${d.value}`;
  return `${d.value} free`;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; code: string; coupon_type: string; name: string; status: string;
    discount: Discount; current_redemptions: number; global_limit: number | null;
    valid_to: string; stacking_rule: string; distribution_channels: string[];
  }>(
    `SELECT id, code, coupon_type, name, status, discount, current_redemptions,
            global_limit, valid_to, stacking_rule, distribution_channels
     FROM coupon ORDER BY created_at DESC`,
  );

  return Response.json({
    coupons: rows.rows.map(c => ({
      id: c.id, code: c.code, type: c.coupon_type, name: c.name, status: c.status,
      discount: formatDiscount(c.discount), redemptions: c.current_redemptions,
      globalLimit: c.global_limit ?? undefined, validTo: c.valid_to,
      stackingRule: c.stacking_rule, channel: c.distribution_channels,
    })),
  });
}

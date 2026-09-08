import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { Coupon, type CouponType, type CouponDiscount } from '@/domain/coupon/Coupon';

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

// POST /api/coupons -- Create Promotion. coupon table + Coupon.ts's full
// validation/state-machine class already existed with zero creation path
// anywhere (found live 2026-09-02) -- only GET (list) and PATCH (transition
// an existing row) existed. New coupons start 'draft' (Coupon's own
// constructor default entry point into its state machine).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    code?: string; type?: CouponType; name?: string; description?: string;
    discount?: CouponDiscount; validFrom?: string; validTo?: string;
    perCustomerLimit?: number; globalLimit?: number;
  } | null;
  if (!body?.code || !body.type || !body.name || !body.discount || !body.validFrom || !body.validTo) {
    return Response.json({ error: 'code, type, name, discount, validFrom, and validTo are required.' }, { status: 400 });
  }

  let coupon: Coupon;
  try {
    coupon = new Coupon({
      id: '', code: body.code.toUpperCase().trim(), type: body.type, name: body.name, description: body.description ?? '',
      status: 'draft', discount: body.discount, eligibility: {},
      limits: { perCustomerLimit: body.perCustomerLimit ?? 1, perOrderLimit: 1, currentRedemptions: 0, globalLimit: body.globalLimit },
      stackingRule: 'exclusive', stackingPriority: 0, validFrom: new Date(body.validFrom), validTo: new Date(body.validTo),
      timezone: 'America/Edmonton', blackoutPeriods: [], distributionChannels: [], isAutoApplied: false, isSingleUse: false,
      notes: '', createdBy: principal!.email ?? principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid coupon.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO coupon (tenant_id, code, coupon_type, name, description, status, discount, per_customer_limit, per_order_limit, global_limit, current_redemptions, stacking_rule, stacking_priority, valid_from, valid_to, timezone, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb,$7,1,$8,0,'exclusive',0,$9,$10,'America/Edmonton',$11) RETURNING id`,
      [tenantId, coupon.code, coupon.type, coupon.name, body.description ?? '', JSON.stringify(coupon.discount),
       coupon.limits.perCustomerLimit, coupon.limits.globalLimit ?? null, coupon.validFrom, coupon.validTo, principal!.email ?? principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A coupon with this code already exists.' : message }, { status });
  }
}

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { TOGGLEABLE_FEATURES, VALID_TOGGLEABLE_KEYS } from '@/domain/customer/ToggleableFeatures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const result = await query<{ disabled_features: string[] }>(`SELECT disabled_features FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!result.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  return Response.json({ disabledFeatures: result.rows[0].disabled_features, availableFeatures: TOGGLEABLE_FEATURES });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { disabledFeatures?: string[] } | null;
  if (!body?.disabledFeatures || !Array.isArray(body.disabledFeatures)) {
    return Response.json({ error: 'disabledFeatures must be an array.' }, { status: 400 });
  }
  const invalid = body.disabledFeatures.filter(k => !VALID_TOGGLEABLE_KEYS.has(k as (typeof TOGGLEABLE_FEATURES)[number]['key']));
  if (invalid.length) return Response.json({ error: `Unknown feature key(s): ${invalid.join(', ')}` }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const result = await query<{ disabled_features: string[] }>(
    `UPDATE customer SET disabled_features = $2, updated_at = now() WHERE user_id = $1 RETURNING disabled_features`,
    [principal!.id, body.disabledFeatures],
  );
  if (!result.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  return Response.json({ disabledFeatures: result.rows[0].disabled_features });
}

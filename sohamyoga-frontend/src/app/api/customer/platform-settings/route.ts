import { NextRequest } from 'next/server';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { principal, denied } = await getCustomerPrincipal(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const customerId = parseInt(principal!.id, 10);

    const result = await query<{
      platform: string;
      display_name: string;
      category: string;
      globally_enabled: boolean;
      customer_enabled: boolean;
      enabled_by: string;
    }>(`
      SELECT
        rsp.platform,
        COALESCE(rsp.display_name, rsp.platform) AS display_name,
        COALESCE(rsp.category, 'other') AS category,
        COALESCE(pic.is_enabled, false) AS globally_enabled,
        COALESCE(ct.is_enabled, true) AS customer_enabled,
        COALESCE(ct.enabled_by, 'admin') AS enabled_by
      FROM ref_social_platform rsp
      LEFT JOIN platform_integration_config pic ON pic.platform = rsp.platform
      LEFT JOIN platform_customer_toggle ct ON ct.platform = rsp.platform AND ct.customer_id = $1
      WHERE COALESCE(pic.is_enabled, false) = true
      ORDER BY rsp.display_name
    `, [customerId]);

    return Response.json({ platforms: result.rows });
  } catch (err) {
    console.error('customer platform-settings GET error:', err);
    return Response.json({ error: 'Failed to load platform settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { principal, denied } = await getCustomerPrincipal(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const customerId = parseInt(principal!.id, 10);
    const body = await req.json() as { platform: string; enabled: boolean };

    if (!body.platform || typeof body.enabled !== 'boolean') {
      return Response.json({ error: 'platform and enabled (boolean) are required' }, { status: 400 });
    }

    // Verify platform is globally enabled
    const globalCheck = await query<{ is_enabled: boolean }>(
      'SELECT is_enabled FROM platform_integration_config WHERE platform = $1',
      [body.platform]
    );

    if (globalCheck.rows.length === 0 || !globalCheck.rows[0].is_enabled) {
      return Response.json({ error: 'Platform is not globally available' }, { status: 403 });
    }

    const result = await query(
      `INSERT INTO platform_customer_toggle (customer_id, platform, is_enabled, enabled_by, enabled_at)
       VALUES ($1, $2, $3, 'customer', NOW())
       ON CONFLICT (customer_id, platform) DO UPDATE SET is_enabled = $3, enabled_by = 'customer', enabled_at = NOW()
       RETURNING *`,
      [customerId, body.platform, body.enabled]
    );

    return Response.json({ toggle: result.rows[0] });
  } catch (err) {
    console.error('customer platform-settings PATCH error:', err);
    return Response.json({ error: 'Failed to update platform setting' }, { status: 500 });
  }
}

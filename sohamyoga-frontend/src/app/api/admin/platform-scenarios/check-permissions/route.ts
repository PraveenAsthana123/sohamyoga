import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const { platform, feature_type, actor_type = 'customer' } = await req.json() as {
    platform: string;
    feature_type: string;
    actor_type?: string;
  };

  if (!platform || !feature_type) {
    return Response.json({ error: 'platform and feature_type required' }, { status: 400 });
  }

  const rows = await query(
    `SELECT admin_enabled, customer_enabled, requires_approval, approval_mode, customer_daily_limit, customer_monthly_limit
     FROM platform_feature_permission WHERE platform=$1 AND feature_type=$2`,
    [platform, feature_type]
  );

  if (!rows.rows.length) {
    // Default deny if not configured
    return Response.json({ allowed: false, requires_approval: false, message: 'Feature not configured for this platform.' });
  }

  const perm = rows.rows[0] as {
    admin_enabled: boolean;
    customer_enabled: boolean;
    requires_approval: boolean;
    approval_mode: string;
    customer_daily_limit: number | null;
    customer_monthly_limit: number | null;
  };

  if (actor_type === 'admin') {
    return Response.json({ allowed: perm.admin_enabled, requires_approval: false });
  }

  // Customer path — admin_enabled must also be true
  if (!perm.admin_enabled) {
    return Response.json({ allowed: false, requires_approval: false, message: 'This feature has been disabled by your administrator.' });
  }

  if (!perm.customer_enabled) {
    return Response.json({ allowed: false, requires_approval: false, message: 'This feature is not available. Contact your admin.' });
  }

  return Response.json({
    allowed: true,
    requires_approval: perm.requires_approval,
    approval_mode: perm.approval_mode,
    customer_daily_limit: perm.customer_daily_limit,
    customer_monthly_limit: perm.customer_monthly_limit,
  });
}

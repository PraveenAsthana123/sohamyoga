import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await req.json() as { platforms: string[]; enabled: boolean };

    if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
      return Response.json({ error: 'platforms array is required' }, { status: 400 });
    }

    if (typeof body.enabled !== 'boolean') {
      return Response.json({ error: 'enabled (boolean) is required' }, { status: 400 });
    }

    const sanitized = body.platforms.filter(p => typeof p === 'string' && p.length > 0);

    // Build parameterized upsert for each platform
    let updated = 0;
    for (const platform of sanitized) {
      const result = await query(
        `INSERT INTO platform_integration_config (platform, is_enabled)
         VALUES ($1, $2)
         ON CONFLICT (platform) DO UPDATE SET is_enabled = $2, updated_at = NOW()`,
        [platform, body.enabled]
      );
      updated += result.rowCount ?? 0;
    }

    return Response.json({
      success: true,
      updated,
      platforms: sanitized,
      enabled: body.enabled,
    });
  } catch (err) {
    console.error('bulk-toggle error:', err);
    return Response.json({ error: 'Failed to bulk toggle platforms' }, { status: 500 });
  }
}

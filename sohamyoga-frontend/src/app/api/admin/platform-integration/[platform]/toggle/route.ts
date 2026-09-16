import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const body = await req.json() as { enabled: boolean };

    if (typeof body.enabled !== 'boolean') {
      return Response.json({ error: 'enabled (boolean) is required' }, { status: 400 });
    }

    // Upsert the config row
    const result = await query(
      `INSERT INTO platform_integration_config (platform, is_enabled)
       VALUES ($1, $2)
       ON CONFLICT (platform) DO UPDATE SET is_enabled = $2, updated_at = NOW()
       RETURNING *`,
      [platform, body.enabled]
    );

    // Log to operation_ledger if it exists
    try {
      await query(
        `INSERT INTO operation_ledger (operation_type, entity_type, entity_id, description, status, created_at)
         VALUES ('platform_toggle', 'platform', $1, $2, 'completed', NOW())`,
        [platform, `Platform ${platform} ${body.enabled ? 'enabled' : 'disabled'}`]
      );
    } catch {
      // operation_ledger may not exist — ignore
    }

    return Response.json({
      success: true,
      platform,
      is_enabled: body.enabled,
      config: result.rows[0],
    });
  } catch (err) {
    console.error(`platform toggle [${platform}] error:`, err);
    return Response.json({ error: 'Failed to toggle platform' }, { status: 500 });
  }
}

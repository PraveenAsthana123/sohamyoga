// POST /api/admin/platform-credentials/[platform]/reset
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured' }, { status: 503 });

  const { platform } = await params;

  try {
    // Reset all steps
    await query(
      `UPDATE platform_setup_step SET is_completed = false, completed_at = NULL WHERE platform = $1`,
      [platform]
    );

    // Reset platform config (keep display info, clear operational fields)
    await query(
      `UPDATE platform_credential_config
       SET setup_status = 'not_started',
           configured_env_vars = '{}',
           setup_steps_completed = 0,
           test_result = NULL,
           test_error = NULL,
           last_tested_at = NULL,
           setup_started_at = NULL,
           setup_completed_at = NULL,
           updated_at = NOW()
       WHERE platform = $1`,
      [platform]
    );

    // Log
    await query(
      `INSERT INTO platform_setup_log (platform, action, details) VALUES ($1, 'reset', '{}')`,
      [platform]
    );

    return Response.json({ success: true, message: `${platform} setup reset successfully` });
  } catch (err) {
    console.error('[platform-credentials/[platform]/reset] error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

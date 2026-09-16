// GET /api/admin/platform-credentials/[platform]/steps
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured' }, { status: 503 });

  const { platform } = await params;

  try {
    const result = await query(
      `SELECT * FROM platform_setup_step WHERE platform = $1 ORDER BY step_number`,
      [platform]
    );
    return Response.json({ steps: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

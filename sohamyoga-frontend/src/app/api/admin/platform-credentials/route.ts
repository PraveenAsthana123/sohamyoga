// GET /api/admin/platform-credentials — list all platforms
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const result = await query(`
      SELECT
        pcc.*,
        COUNT(pss.id) FILTER (WHERE pss.is_completed = true) AS steps_completed_count,
        COUNT(pss.id) AS steps_total_count
      FROM platform_credential_config pcc
      LEFT JOIN platform_setup_step pss ON pss.platform = pcc.platform
      GROUP BY pcc.id
      ORDER BY
        CASE pcc.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        pcc.display_name
    `);
    return NextResponse.json({ platforms: result.rows });
  } catch (err) {
    console.error('[platform-credentials] GET error:', err);
    return NextResponse.json({ error: 'Failed to load platforms' }, { status: 500 });
  }
}

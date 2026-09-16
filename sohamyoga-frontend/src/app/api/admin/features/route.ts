export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [features, gapReports] = await Promise.all([
      client.query(`
        SELECT fr.*,
          COUNT(DISTINCT mf.module_id) as module_count
        FROM feature_registry fr
        LEFT JOIN module_feature mf ON mf.feature_key = fr.feature_key
        GROUP BY fr.id
        ORDER BY fr.category, fr.feature_key
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT * FROM feature_gap_report
        ORDER BY created_at DESC LIMIT 50
      `).catch(() => ({ rows: [] })),
    ]);

    const summary = {
      total: features.rows.length,
      byStatus: features.rows.reduce<Record<string, number>>((acc, f) => {
        const s = f.status ?? 'unknown';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {}),
      byCategory: features.rows.reduce<Record<string, number>>((acc, f) => {
        const c = f.category ?? 'uncategorized';
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      features: features.rows,
      gapReports: gapReports.rows,
      summary,
    });
  } finally {
    client.release();
  }
}

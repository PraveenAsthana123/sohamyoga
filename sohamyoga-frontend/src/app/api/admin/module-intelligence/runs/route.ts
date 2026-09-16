import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const moduleKey = searchParams.get('module_key');
  const sessionId = searchParams.get('session_id');

  if (sessionId) {
    // Return results for a specific session
    const results = await query(
      `SELECT trr.*, tce.case_key, tce.name as case_name, tce.test_level, tce.polarity
       FROM test_run_result trr
       LEFT JOIN test_case_extended tce ON tce.id = trr.case_id
       WHERE trr.session_id = $1
       ORDER BY trr.run_at DESC`,
      [sessionId],
    );
    return Response.json(results.rows);
  }

  let sql = `SELECT trs.*, mr.name as module_name FROM test_run_session trs
             LEFT JOIN module_registry mr ON mr.module_key = trs.module_key
             WHERE 1=1`;
  const params: unknown[] = [];
  if (moduleKey) { params.push(moduleKey); sql += ` AND trs.module_key = $${params.length}`; }
  sql += ' ORDER BY trs.started_at DESC LIMIT 100';

  const result = await query(sql, params);
  return Response.json(result.rows);
}

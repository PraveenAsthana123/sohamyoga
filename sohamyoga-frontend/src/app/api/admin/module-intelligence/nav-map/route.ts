import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const portal = searchParams.get('portal');
  const moduleKey = searchParams.get('module_key');

  let sql = `SELECT mnm.*, mr.name as module_name FROM module_nav_map mnm
             LEFT JOIN module_registry mr ON mr.module_key = mnm.module_key WHERE 1=1`;
  const params: unknown[] = [];

  if (portal && portal !== 'both') { params.push(portal); sql += ` AND mnm.portal = $${params.length}`; }
  if (moduleKey) { params.push(moduleKey); sql += ` AND mnm.module_key = $${params.length}`; }
  sql += ' ORDER BY mnm.portal, mnm.module_key LIMIT 1000';

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}

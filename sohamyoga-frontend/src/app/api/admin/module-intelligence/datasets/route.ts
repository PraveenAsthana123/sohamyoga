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
  const source = searchParams.get('source');

  let sql = `SELECT td.*, mr.name as module_name FROM test_dataset td
             LEFT JOIN module_registry mr ON mr.module_key = td.module_key WHERE 1=1`;
  const params: unknown[] = [];

  if (moduleKey) { params.push(moduleKey); sql += ` AND td.module_key = $${params.length}`; }
  if (source && source !== 'all') { params.push(source); sql += ` AND td.source = $${params.length}`; }
  sql += ' ORDER BY td.created_at DESC LIMIT 500';

  const result = await query(sql, params);
  return Response.json(result.rows);
}

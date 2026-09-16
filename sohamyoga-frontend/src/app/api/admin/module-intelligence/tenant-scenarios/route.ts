import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const tenantType = searchParams.get('tenant_type');
  const moduleKey = searchParams.get('module_key');

  let sql = `SELECT mts.*, mr.name as module_name FROM module_tenant_scenario mts
             LEFT JOIN module_registry mr ON mr.module_key = mts.module_key WHERE 1=1`;
  const params: unknown[] = [];

  if (tenantType && tenantType !== 'all') { params.push(tenantType); sql += ` AND mts.tenant_type = $${params.length}`; }
  if (moduleKey) { params.push(moduleKey); sql += ` AND mts.module_key = $${params.length}`; }
  sql += ' ORDER BY mts.module_key, mts.tenant_type LIMIT 1000';

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const moduleKey = searchParams.get('module_key');
  const severity = searchParams.get('severity');

  let sql = `SELECT mas.*, mr.name as module_name FROM module_alert_scenario mas
             LEFT JOIN module_registry mr ON mr.module_key = mas.module_key WHERE 1=1`;
  const params: unknown[] = [];

  if (moduleKey) { params.push(moduleKey); sql += ` AND mas.module_key = $${params.length}`; }
  if (severity && severity !== 'all') { params.push(severity); sql += ` AND mas.severity = $${params.length}`; }
  sql += ' ORDER BY CASE mas.severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 WHEN \'low\' THEN 4 ELSE 5 END, mas.module_key LIMIT 1000';

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}

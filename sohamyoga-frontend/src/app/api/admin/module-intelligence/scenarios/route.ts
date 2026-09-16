import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const moduleKey = searchParams.get('module_key');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') ?? '500');

  let sql = 'SELECT ms.*, mr.name as module_name FROM module_scenario ms LEFT JOIN module_registry mr ON mr.module_key = ms.module_key WHERE 1=1';
  const params: unknown[] = [];

  if (moduleKey) { params.push(moduleKey); sql += ` AND ms.module_key = $${params.length}`; }
  if (category && category !== 'all') { params.push(category); sql += ` AND ms.scenario_category = $${params.length}`; }
  sql += ' ORDER BY ms.module_key, ms.scenario_category';
  params.push(limit); sql += ` LIMIT $${params.length}`;

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}

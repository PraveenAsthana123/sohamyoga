import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const moduleKey = searchParams.get('module_key');

  let sql = `SELECT tp.*, mr.name as module_name FROM test_plan tp
             LEFT JOIN module_registry mr ON mr.module_key = tp.module_key
             WHERE 1=1`;
  const params: unknown[] = [];

  if (status) { params.push(status); sql += ` AND tp.status = $${params.length}`; }
  if (moduleKey) { params.push(moduleKey); sql += ` AND tp.module_key = $${params.length}`; }
  sql += ' ORDER BY tp.created_at DESC LIMIT 500';

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const body = await req.json() as {
    module_key: string; plan_name: string; version?: string; objective?: string;
    scope_in?: string; scope_out?: string; environment?: string; test_data_source?: string;
    kaggle_dataset?: string; status?: string;
  };

  const result = await query(
    `INSERT INTO test_plan (module_key, plan_name, version, objective, scope_in, scope_out,
       environment, test_data_source, kaggle_dataset, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'admin')
     RETURNING *`,
    [body.module_key, body.plan_name, body.version ?? '1.0', body.objective ?? null,
      body.scope_in ?? null, body.scope_out ?? null, body.environment ?? 'local',
      body.test_data_source ?? 'synthetic', body.kaggle_dataset ?? null, body.status ?? 'draft'],
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

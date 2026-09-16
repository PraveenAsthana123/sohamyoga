import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const moduleKey = searchParams.get('module_key');
  const level = searchParams.get('level');
  const polarity = searchParams.get('polarity');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') ?? '200');
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let sql = 'SELECT * FROM test_case_extended WHERE 1=1';
  const params: unknown[] = [];

  if (moduleKey) { params.push(moduleKey); sql += ` AND module_key = $${params.length}`; }
  if (level && level !== 'all') { params.push(level); sql += ` AND test_level = $${params.length}`; }
  if (polarity && polarity !== 'all') { params.push(polarity); sql += ` AND polarity = $${params.length}`; }
  if (status && status !== 'all') { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += ' ORDER BY created_at DESC';
  params.push(limit); sql += ` LIMIT $${params.length}`;
  params.push(offset); sql += ` OFFSET $${params.length}`;

  const result = await query(sql, params);

  // Count
  let countSql = 'SELECT COUNT(*) FROM test_case_extended WHERE 1=1';
  const countParams: unknown[] = [];
  if (moduleKey) { countParams.push(moduleKey); countSql += ` AND module_key = $${countParams.length}`; }
  if (level && level !== 'all') { countParams.push(level); countSql += ` AND test_level = $${countParams.length}`; }
  if (polarity && polarity !== 'all') { countParams.push(polarity); countSql += ` AND polarity = $${countParams.length}`; }
  if (status && status !== 'all') { countParams.push(status); countSql += ` AND status = $${countParams.length}`; }
  const countResult = await query(countSql, countParams);

  return NextResponse.json({ rows: result.rows, total: parseInt(countResult.rows[0].count) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const body = await req.json() as {
    plan_id?: string; module_key: string; suite_key?: string; case_key: string;
    name: string; test_level: string; polarity: string; scenario_type?: string;
    precondition?: string; steps?: unknown[]; expected_result?: string;
    api_endpoint?: string; ui_field?: string; http_method?: string;
    request_payload?: unknown; expected_status?: number; tags?: string[];
    priority?: string;
  };

  const result = await query(
    `INSERT INTO test_case_extended (plan_id, module_key, suite_key, case_key, name, test_level,
       polarity, scenario_type, precondition, steps, expected_result, api_endpoint, ui_field,
       http_method, request_payload, expected_status, tags, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16,$17::text[],$18,'pending')
     ON CONFLICT (case_key) DO UPDATE SET name=EXCLUDED.name, updated_at=NOW()
     RETURNING *`,
    [body.plan_id ?? null, body.module_key, body.suite_key ?? null, body.case_key,
      body.name, body.test_level, body.polarity, body.scenario_type ?? null,
      body.precondition ?? null, JSON.stringify(body.steps ?? []), body.expected_result ?? null,
      body.api_endpoint ?? null, body.ui_field ?? null, body.http_method ?? null,
      JSON.stringify(body.request_payload ?? {}), body.expected_status ?? null,
      `{${(body.tags ?? []).join(',')}}`, body.priority ?? 'medium'],
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

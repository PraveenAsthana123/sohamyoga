// ModuleTestSchedulerJob — Weekly Monday 06:00 UTC
// Runs all API-level test cases for modules that have automatic_enabled=true
// test suites in test_suite_master. Records results in test_run_session and
// test_run_result. Updates test_case_extended.last_run_at and status.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

interface TestCase {
  id: string;
  module_key: string;
  case_key: string;
  test_level: string;
  api_endpoint: string | null;
  http_method: string | null;
  expected_status: number | null;
  request_payload: unknown;
}

async function runApiCase(tc: TestCase): Promise<{
  status: string; httpStatus: number | null; durationMs: number; failureReason: string | null; responseBody: unknown;
}> {
  if (!tc.api_endpoint) {
    return { status: 'skip', httpStatus: null, durationMs: 0, failureReason: 'No api_endpoint configured', responseBody: null };
  }

  const start = Date.now();
  try {
    const method = (tc.http_method ?? 'GET').toUpperCase();
    const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    const response = await fetch(`${BASE_URL}${tc.api_endpoint}`, fetchOpts);
    const durationMs = Date.now() - start;
    const httpStatus = response.status;

    let responseBody: unknown = null;
    try { responseBody = await response.json(); } catch { responseBody = null; }

    const isPass = tc.expected_status
      ? response.status === tc.expected_status || (response.status < 400 && tc.expected_status < 400)
      : response.status < 500;

    return {
      status: isPass ? 'pass' : 'fail',
      httpStatus,
      durationMs,
      failureReason: isPass ? null : `Expected ${tc.expected_status ?? '<500'}, got ${response.status}`,
      responseBody,
    };
  } catch (err) {
    return {
      status: 'fail',
      httpStatus: null,
      durationMs: Date.now() - start,
      failureReason: (err as Error).message,
      responseBody: null,
    };
  }
}

export async function run(): Promise<void> {
  console.log('[ModuleTestSchedulerJob] Starting weekly API test run');

  // Find modules with automatic_enabled test suites
  let targetModules: string[] = [];
  try {
    const suitesRes = await db.query<{ module_key: string }>(
      `SELECT DISTINCT module_key FROM test_suite_master WHERE automatic_enabled = true`,
    );
    targetModules = suitesRes.rows.map(r => r.module_key);
  } catch {
    // test_suite_master may not have module_key or automatic_enabled — fall back to all real modules
    console.warn('[ModuleTestSchedulerJob] test_suite_master query failed, running all real modules');
    const modRes = await db.query<{ module_key: string }>(
      `SELECT module_key FROM module_registry WHERE built_status = 'real' LIMIT 50`,
    );
    targetModules = modRes.rows.map(r => r.module_key);
  }

  if (!targetModules.length) {
    console.log('[ModuleTestSchedulerJob] No modules to test — nothing to do');
    return;
  }

  console.log(`[ModuleTestSchedulerJob] Testing ${targetModules.length} modules`);
  let totalPass = 0, totalFail = 0, totalSkip = 0;

  for (const moduleKey of targetModules) {
    // Create session
    const sessRes = await db.query<{ id: string }>(
      `INSERT INTO test_run_session (module_key, run_label, trigger, runner, status, environment)
       VALUES ($1,$2,'cron','api-runner','running','local')
       RETURNING id`,
      [moduleKey, `Weekly auto-run ${new Date().toISOString()}`],
    );
    const sessionId = sessRes.rows[0].id;

    // Get API-level cases
    const cases = await db.query<TestCase>(
      `SELECT id, module_key, case_key, test_level, api_endpoint, http_method, expected_status, request_payload
       FROM test_case_extended
       WHERE module_key = $1 AND test_level = 'api'`,
      [moduleKey],
    );

    let modPass = 0, modFail = 0, modSkip = 0;

    for (const tc of cases.rows) {
      const result = await runApiCase(tc);

      await db.query(
        `INSERT INTO test_run_result (session_id, case_id, module_key, status, failure_reason, http_status, response_body, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [sessionId, tc.id, tc.module_key, result.status, result.failureReason,
          result.httpStatus, JSON.stringify(result.responseBody), result.durationMs],
      );

      await db.query(
        `UPDATE test_case_extended SET status=$1, failure_reason=$2, last_run_at=NOW(), run_count=run_count+1, duration_ms=$3 WHERE id=$4`,
        [result.status, result.failureReason, result.durationMs, tc.id],
      );

      if (result.status === 'pass') { modPass++; totalPass++; }
      else if (result.status === 'fail') { modFail++; totalFail++; }
      else { modSkip++; totalSkip++; }
    }

    const total = modPass + modFail + modSkip;
    const passRate = total > 0 ? Math.round((modPass / Math.max(modPass + modFail, 1)) * 100 * 100) / 100 : 0;

    await db.query(
      `UPDATE test_run_session SET status='completed', completed_at=NOW(),
         total=$1, passed=$2, failed=$3, skipped=$4, pass_rate=$5
       WHERE id=$6`,
      [total, modPass, modFail, modSkip, passRate, sessionId],
    );

    console.log(`[ModuleTestSchedulerJob] ${moduleKey}: ${modPass}/${total} pass (${passRate}%)`);
  }

  console.log(`[ModuleTestSchedulerJob] Done — total: pass=${totalPass} fail=${totalFail} skip=${totalSkip}`);
  await db.end();
}

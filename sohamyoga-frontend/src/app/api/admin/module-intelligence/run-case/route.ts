import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json() as { case_id?: string; case_key?: string; session_id?: string };

  // Resolve case
  let caseResult;
  if (body.case_id) {
    caseResult = await query('SELECT * FROM test_case_extended WHERE id = $1', [body.case_id]);
  } else if (body.case_key) {
    caseResult = await query('SELECT * FROM test_case_extended WHERE case_key = $1', [body.case_key]);
  } else {
    return Response.json({ error: 'case_id or case_key required' }, { status: 400 });
  }

  if (!caseResult.rows.length) {
    return Response.json({ error: 'Test case not found' }, { status: 404 });
  }

  const tc = caseResult.rows[0] as {
    id: string; module_key: string; test_level: string; api_endpoint: string | null;
    http_method: string | null; expected_status: number | null; request_payload: unknown;
    case_key: string;
  };

  // Create or use session
  let sessionId = body.session_id;
  if (!sessionId) {
    const sessRes = await query(
      `INSERT INTO test_run_session (module_key, run_label, trigger, runner, status)
       VALUES ($1,$2,'manual','api-runner','running')
       RETURNING id`,
      [tc.module_key, `Manual run ${new Date().toISOString()}`],
    );
    sessionId = sessRes.rows[0].id as string;
  }

  let status = 'skip';
  let httpStatus: number | null = null;
  let responseBody: unknown = null;
  let failureReason: string | null = null;
  let durationMs = 0;

  if (tc.test_level === 'api' && tc.api_endpoint) {
    const start = Date.now();
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}${tc.api_endpoint}`;
      const method = (tc.http_method ?? 'GET').toUpperCase();

      const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
      if (method !== 'GET' && method !== 'HEAD' && tc.request_payload) {
        fetchOpts.body = JSON.stringify(tc.request_payload);
      }

      const response = await fetch(url, fetchOpts);
      durationMs = Date.now() - start;
      httpStatus = response.status;

      let body: unknown = null;
      try { body = await response.json(); } catch { body = null; }
      responseBody = body;

      const expectedStatus = tc.expected_status ?? 200;
      if (response.status < 500) {
        // Pass if: status matches expected, or expected is 400/422 and we got one, or status < 400 for positive
        const isPass = tc.expected_status
          ? response.status === tc.expected_status || (response.status < 400 && tc.expected_status < 400)
          : response.status < 500;
        status = isPass ? 'pass' : 'fail';
        if (!isPass) failureReason = `Expected status ${expectedStatus}, got ${response.status}`;
      } else {
        status = 'fail';
        failureReason = `Server error: ${response.status}`;
      }
    } catch (err) {
      durationMs = Date.now() - start;
      status = 'fail';
      failureReason = `Fetch error: ${(err as Error).message}`;
    }
  } else {
    status = 'skip';
    failureReason = `Skipped: test_level=${tc.test_level} — only api-level tests auto-run`;
  }

  // Save result
  await query(
    `INSERT INTO test_run_result (session_id, case_id, module_key, status, failure_reason, http_status, response_body, duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [sessionId, tc.id, tc.module_key, status, failureReason, httpStatus,
      JSON.stringify(responseBody), durationMs],
  );

  // Update test_case_extended
  await query(
    `UPDATE test_case_extended SET status=$1, actual_result=$2, failure_reason=$3,
       last_run_at=NOW(), run_count=run_count+1, duration_ms=$4
     WHERE id=$5`,
    [status, responseBody ? JSON.stringify(responseBody).slice(0, 500) : null,
      failureReason, durationMs, tc.id],
  );

  // Update session totals
  await query(
    `UPDATE test_run_session SET
       total = (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1),
       passed = (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='pass'),
       failed = (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='fail'),
       skipped = (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='skip'),
       pass_rate = CASE WHEN (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status IN ('pass','fail')) > 0
         THEN ROUND(100.0 * (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='pass') /
              NULLIF((SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status IN ('pass','fail')),0), 2)
         ELSE 0 END
     WHERE id=$1`,
    [sessionId],
  );

  return Response.json({
    case_key: tc.case_key, session_id: sessionId, status, http_status: httpStatus,
    duration_ms: durationMs, failure_reason: failureReason, response_body: responseBody,
  });
}

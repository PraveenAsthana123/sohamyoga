import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const body = await req.json() as { module_key: string; test_level?: string; plan_id?: string };
  if (!body.module_key) return NextResponse.json({ error: 'module_key required' }, { status: 400 });

  // Create session
  const sessRes = await query(
    `INSERT INTO test_run_session (module_key, plan_id, run_label, trigger, runner, status, environment)
     VALUES ($1,$2,$3,'manual','api-runner','running','local')
     RETURNING id`,
    [body.module_key, body.plan_id ?? null, `Suite run ${new Date().toISOString()}`],
  );
  const sessionId = sessRes.rows[0].id as string;

  // Fire and forget
  setImmediate(async () => {
    try {
      let sql = `SELECT * FROM test_case_extended WHERE module_key = $1`;
      const params: unknown[] = [body.module_key];
      if (body.test_level) { params.push(body.test_level); sql += ` AND test_level = $${params.length}`; }

      const cases = await query(sql, params);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

      for (const tc of cases.rows as Array<{
        id: string; test_level: string; api_endpoint: string | null; http_method: string | null;
        expected_status: number | null; request_payload: unknown; case_key: string; module_key: string;
      }>) {
        let status = 'skip';
        let httpStatus: number | null = null;
        let responseBody: unknown = null;
        let failureReason: string | null = null;
        let durationMs = 0;

        if (tc.test_level === 'api' && tc.api_endpoint) {
          const start = Date.now();
          try {
            const method = (tc.http_method ?? 'GET').toUpperCase();
            const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
            if (method !== 'GET' && tc.request_payload) fetchOpts.body = JSON.stringify(tc.request_payload);

            const response = await fetch(`${baseUrl}${tc.api_endpoint}`, fetchOpts);
            durationMs = Date.now() - start;
            httpStatus = response.status;
            try { responseBody = await response.json(); } catch { responseBody = null; }

            const isPass = tc.expected_status
              ? response.status === tc.expected_status || (response.status < 400 && tc.expected_status < 400)
              : response.status < 500;
            status = isPass ? 'pass' : 'fail';
            if (!isPass) failureReason = `Expected ${tc.expected_status ?? '<500'}, got ${response.status}`;
          } catch (err) {
            durationMs = Date.now() - start;
            status = 'fail';
            failureReason = (err as Error).message;
          }
        } else {
          status = 'skip';
          failureReason = `Level ${tc.test_level} not auto-runnable`;
        }

        await query(
          `INSERT INTO test_run_result (session_id, case_id, module_key, status, failure_reason, http_status, response_body, duration_ms)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [sessionId, tc.id, tc.module_key, status, failureReason, httpStatus, JSON.stringify(responseBody), durationMs],
        );
        await query(
          `UPDATE test_case_extended SET status=$1, failure_reason=$2, last_run_at=NOW(), run_count=run_count+1, duration_ms=$3 WHERE id=$4`,
          [status, failureReason, durationMs, tc.id],
        );
      }

      // Finalize session
      await query(
        `UPDATE test_run_session SET
           status='completed', completed_at=NOW(),
           total=(SELECT COUNT(*) FROM test_run_result WHERE session_id=$1),
           passed=(SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='pass'),
           failed=(SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='fail'),
           skipped=(SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='skip'),
           pass_rate=CASE WHEN (SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status IN ('pass','fail'))>0
             THEN ROUND(100.0*(SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status='pass')/
               NULLIF((SELECT COUNT(*) FROM test_run_result WHERE session_id=$1 AND status IN ('pass','fail')),0),2)
             ELSE 0 END
         WHERE id=$1`,
        [sessionId],
      );
    } catch (err) {
      console.error('[run-suite] Error:', err);
      await query(`UPDATE test_run_session SET status='aborted', completed_at=NOW() WHERE id=$1`, [sessionId]);
    }
  });

  return NextResponse.json({ session_id: sessionId, status: 'running', module_key: body.module_key });
}

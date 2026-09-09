// DeepTestAdvisoryJob — Ollama advisory pass over the real Playwright suite.
// §166 "advise" step for playwright_suite_run: picks the most recent
// completed run with no advisory yet, reads its real failed test cases
// (never invents a failure that didn't happen), and asks Ollama for a
// root-cause theme + suggested fix per distinct failure pattern. Draft
// only — never auto-applied, never auto-files a fix. Complements
// ModuleBoundaryQualityJob (reviews static source) with a review of what
// the actual browser run showed.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { extractJson } from '../moduleRegistry';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a QA lead reviewing real Playwright e2e test failures from one suite run.
You are given the exact failing test titles, spec files, and error messages — nothing
fabricated. Group failures into distinct root-cause themes (e.g. "auth session not
established before test", "selector changed", "real backend dependency down") rather
than listing each failure separately if several share a cause.
Return exactly one JSON object with keys:
  summary (2-3 sentences: overall health of this run, in plain language),
  themes (array of objects, each { theme: string, affected_tests: string[] (test titles
    from the input, verbatim), likely_cause: string, suggested_fix: string }),
  flaky_suspects (array of strings — test titles that look like environment/timing flakes
    rather than real regressions, e.g. timeouts with no assertion failure; empty array if none).
No markdown, no prose outside the JSON object. If there are zero failures, themes and
flaky_suspects must be empty arrays and summary should say the run was fully green.`;

interface FailedTest { spec_file: string; test_title: string; status: string; error_message: string | null; duration_ms: number }
interface Advisory {
  summary: string;
  themes: Array<{ theme: string; affected_tests: string[]; likely_cause: string; suggested_fix: string }>;
  flaky_suspects: string[];
  raw_prose_fallback?: string;
}

export async function run(): Promise<void> {
  const target = await db.query<{ id: string; total_tests: number; passed: number; failed: number; skipped: number }>(
    `SELECT id, total_tests, passed, failed, skipped FROM playwright_suite_run
     WHERE status = 'completed' AND advisory_text IS NULL
     ORDER BY started_at DESC LIMIT 1`,
  );
  if (!target.rowCount) {
    console.log('[deep-test-advisory] no completed run awaiting advisory -- nothing to do');
    return;
  }
  const runRow = target.rows[0];

  const failures = await db.query<FailedTest>(
    `SELECT spec_file, test_title, status, error_message, duration_ms FROM playwright_test_result
     WHERE suite_run_id = $1 AND status IN ('failed','timedOut') ORDER BY spec_file, test_title`,
    [runRow.id],
  );

  let advisory: Advisory;
  if (!failures.rowCount) {
    advisory = { summary: `Run fully green: ${runRow.passed}/${runRow.total_tests} passed, 0 failed, ${runRow.skipped} skipped.`, themes: [], flaky_suspects: [] };
  } else {
    const prompt = `Run summary: ${runRow.passed}/${runRow.total_tests} passed, ${runRow.failed} failed, ${runRow.skipped} skipped.\n\nFailed tests:\n` +
      failures.rows.map(f => `- [${f.spec_file}] ${f.test_title} (${f.status}, ${f.duration_ms}ms)\n  error: ${(f.error_message ?? 'none').slice(0, 300)}`).join('\n');

    // 900 tokens was enough for a handful of failures but genuinely too
    // tight once a run has 20-30+ across many spec files -- found live:
    // the model's real JSON response got cut off mid-object and failed to
    // parse. Scaling the budget with failure count rather than a single
    // fixed number, capped so a pathological run can't run away.
    const maxTokens = Math.min(3000, 900 + failures.rowCount * 60);
    const reply = await ollama.generate(prompt, { tier: 'strong', system: SYSTEM, maxTokens, timeoutMs: 150_000 });
    try {
      advisory = extractJson<Advisory>(reply);
    } catch (error) {
      // Found live: with 20-30+ failures the model sometimes ignores the
      // "JSON only" instruction and writes a full prose report instead
      // (genuinely useful analysis, just the wrong format) -- keep that
      // real output rather than discarding it for a generic error string.
      console.error('[deep-test-advisory] Ollama response parse failed, keeping raw prose:', error);
      advisory = {
        summary: `${runRow.failed} test(s) failed. Ollama did not return structured JSON for this run -- see raw_prose_fallback for its real analysis.`,
        themes: [], flaky_suspects: [], raw_prose_fallback: reply.slice(0, 6000),
      };
    }
  }

  const advisoryText = JSON.stringify(advisory);
  await db.query(
    `UPDATE playwright_suite_run SET advisory_text = $2, advisory_generated_at = now() WHERE id = $1`,
    [runRow.id, advisoryText],
  );

  if (runRow.failed > 0) {
    const admin = await db.query<{ tenant_id: string; id: string; email: string }>(
      `SELECT tenant_id, id, email FROM app_user WHERE role='admin' AND status='active' LIMIT 1`,
    );
    if (admin.rows[0]) {
      await db.query(
        `INSERT INTO notification_queue
           (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
         VALUES ($1,'deep_test_suite_failures','in_app','alert',$2,$3,$4,$5)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
        [admin.rows[0].tenant_id, admin.rows[0].id, admin.rows[0].email,
          JSON.stringify({ suite_run_id: runRow.id, failed: runRow.failed, total: runRow.total_tests, summary: advisory.summary }),
          `deep_test_advisory_${runRow.id}`],
      );
    }
  }

  console.log(`[deep-test-advisory] run=${runRow.id} failed=${runRow.failed} themes=${advisory.themes.length} flaky_suspects=${advisory.flaky_suspects.length}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}

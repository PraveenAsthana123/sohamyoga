#!/usr/bin/env tsx
// Deep testing job -- runs the real Playwright e2e suite (28 spec files,
// real browser automation against the real running app + Postgres), parses
// the real JSON reporter output, and records one playwright_suite_run row
// plus one playwright_test_result row per test case. This is the "test"
// half of this repo's established §166 action/test/advise pattern; the
// "advise" half (Ollama analysis of failures) is a separate cron job
// (DeepTestAdvisoryJob) that reads the row this script writes.
//
// Deliberately does NOT call Ollama itself -- keeps the real-browser-test
// step and the Ollama-analysis step independently rerunnable/debuggable,
// matching how ModuleBoundaryQualityJob is separate from the code it reads.
import { execFile, execSync } from 'node:child_process';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '..');

// Real bug caught live on the first scheduled cron run: DATABASE_URL was
// never set in cron's minimal environment, so `pg` silently connected to
// Postgres's default port (5432) instead of this stack's real port (5437)
// and crashed with ECONNREFUSED. NODE_OPTIONS="--env-file=..." was tried
// first and rejected by Node itself. Loads .env.local manually instead,
// matching market-research-portal/scripts/migrate.ts's exact pattern --
// also propagates to the child `playwright test` process below (env vars
// set here land in process.env before that spawn).
function loadEnvLocal(): void {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) continue;
    const key = line.slice(0, split).trim();
    const value = line.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();
const JSON_OUTPUT = path.join(REPO_ROOT, 'test-results', 'unified-quality.json');
const cliArgs = process.argv.slice(2);
const TRIGGERED_BY = cliArgs.includes('--manual') ? 'manual' : 'scheduled';
// Any non-flag args (e.g. a spec file path) pass straight through to
// `playwright test`, so a validation run can target one file instead of the
// full suite. Real scheduled runs pass nothing and cover everything.
const playwrightArgs = cliArgs.filter(a => a !== '--manual');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface PwResult { status: string; duration: number; errors?: Array<{ message?: string }>; retry: number }
interface PwTest { projectName: string; results: PwResult[] }
interface PwSpec { title: string; file: string; tests: PwTest[] }
interface PwSuite { title: string; file?: string; specs: PwSpec[]; suites?: PwSuite[] }
interface PwReport { suites: PwSuite[] }

function collectSpecs(suites: PwSuite[], out: PwSpec[] = []): PwSpec[] {
  for (const suite of suites) {
    out.push(...suite.specs);
    if (suite.suites) collectSpecs(suite.suites, out);
  }
  return out;
}

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
  } catch { return null; }
}

async function getModuleKeys(specFile: string): Promise<string[]> {
  const r = await db.query<{ module_keys: string[] }>(
    `SELECT module_keys FROM playwright_spec_module_map WHERE spec_file = $1`, [specFile],
  );
  return r.rows[0]?.module_keys ?? [];
}

async function main() {
  const startedAt = new Date();
  const runResult = await db.query<{ id: string }>(
    `INSERT INTO playwright_suite_run (started_at, triggered_by, git_commit, status)
     VALUES ($1, $2, $3, 'running') RETURNING id`,
    [startedAt, TRIGGERED_BY, gitCommit()],
  );
  const runId = runResult.rows[0].id;
  console.log(`[deep-test-suite] run ${runId} started`);

  // Real bug caught on the first live run: `--reporter=json` on the CLI
  // REPLACES playwright.config.ts's configured reporters (list+json-to-file+
  // html) and, with no explicit output path, writes to STDOUT instead --
  // meaning the previous version of this script silently read a week-old
  // stale JSON_OUTPUT file left over from an earlier session and recorded
  // it as a fresh "34/34 passed" run that never actually executed. Fixed by
  // (1) never passing --reporter on the CLI, so the config's real file-based
  // reporter is used, and (2) deleting JSON_OUTPUT before running so a run
  // that fails to produce a fresh file is unambiguously a crash, never a
  // silent read of stale data.
  if (existsSync(JSON_OUTPUT)) unlinkSync(JSON_OUTPUT);

  try {
    await execFileAsync('npx', ['playwright', 'test', ...playwrightArgs], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024 * 64,
      env: { ...process.env },
      timeout: 20 * 60 * 1000,
    }).catch((err) => {
      // Playwright exits non-zero when tests fail -- that's expected and NOT
      // a crash; the JSON report is still written. Only truly missing output
      // (dev server unreachable, config error) counts as a crash below.
      if (!existsSync(JSON_OUTPUT)) throw err;
    });

    if (!existsSync(JSON_OUTPUT)) {
      throw new Error('Playwright produced no JSON report -- suite did not run at all.');
    }

    const report: PwReport = JSON.parse(readFileSync(JSON_OUTPUT, 'utf8'));
    const specs = collectSpecs(report.suites ?? []);

    let passed = 0, failed = 0, skipped = 0, total = 0;
    const moduleKeyCache = new Map<string, string[]>();

    for (const spec of specs) {
      const specFile = path.basename(spec.file);
      if (!moduleKeyCache.has(specFile)) moduleKeyCache.set(specFile, await getModuleKeys(specFile));
      const moduleKeys = moduleKeyCache.get(specFile)!;

      for (const test of spec.tests) {
        const last = test.results[test.results.length - 1];
        if (!last) continue;
        total++;
        // Playwright's real per-attempt statuses: passed/failed/timedOut/skipped/
        // interrupted. The DB CHECK constraint only models the first four (what
        // a genuine test verdict looks like) -- 'interrupted' (run aborted
        // mid-test, e.g. a worker crash) is recorded as 'failed' rather than
        // thrown away or crashing this whole batch write on a constraint violation.
        const KNOWN = new Set(['passed', 'failed', 'timedOut', 'skipped']);
        const status = KNOWN.has(last.status) ? last.status : 'failed';
        if (status === 'passed') passed++;
        else if (status === 'skipped') skipped++;
        else failed++;

        const testTitle = `${spec.title} [${test.projectName}]`;
        const errorMessage = last.errors?.[0]?.message?.slice(0, 4000) ?? null;

        await db.query(
          `INSERT INTO playwright_test_result
             (suite_run_id, spec_file, module_keys, test_title, status, duration_ms, error_message, retries)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [runId, specFile, moduleKeys, testTitle, status,
            Math.round(last.duration ?? 0), errorMessage, test.results.length - 1],
        );

        // Real defect tracking -- the same failing (spec_file, test_title)
        // persists as one open row across however many nights it keeps
        // failing, rather than N disconnected per-run rows with no memory.
        // Closed the first run that same test passes again.
        if (status === 'failed' || status === 'timedOut') {
          await db.query(
            `INSERT INTO playwright_test_defect
               (spec_file, test_title, module_keys, status, first_seen_run_id, first_seen_at,
                last_seen_run_id, last_seen_at, occurrence_count, latest_error_message)
             VALUES ($1,$2,$3,'open',$4,now(),$4,now(),1,$5)
             ON CONFLICT (spec_file, test_title) DO UPDATE SET
               status = 'open', last_seen_run_id = $4, last_seen_at = now(),
               occurrence_count = playwright_test_defect.occurrence_count + 1,
               latest_error_message = $5, module_keys = $3,
               resolved_run_id = NULL, resolved_at = NULL`,
            [specFile, testTitle, moduleKeys, runId, errorMessage],
          );
        } else if (status === 'passed') {
          await db.query(
            `UPDATE playwright_test_defect SET status = 'fixed', resolved_run_id = $3, resolved_at = now()
             WHERE spec_file = $1 AND test_title = $2 AND status = 'open'`,
            [specFile, testTitle, runId],
          );
        }
      }
    }

    await db.query(
      `UPDATE playwright_suite_run
       SET finished_at = now(), total_tests = $2, passed = $3, failed = $4, skipped = $5, status = 'completed'
       WHERE id = $1`,
      [runId, total, passed, failed, skipped],
    );
    console.log(`[deep-test-suite] run ${runId} completed: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db.query(
      `UPDATE playwright_suite_run SET finished_at = now(), status = 'crashed', crash_reason = $2 WHERE id = $1`,
      [runId, reason.slice(0, 2000)],
    );
    console.error(`[deep-test-suite] run ${runId} crashed:`, reason);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
